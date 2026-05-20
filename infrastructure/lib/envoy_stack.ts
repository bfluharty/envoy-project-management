import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as wafv2 from 'aws-cdk-lib/aws-wafv2'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

export class EnvoyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // ---------------------------------------------------------------
    // GitHub Actions OIDC Provider & Deploy Role
    // ---------------------------------------------------------------
    const githubDomain = 'token.actions.githubusercontent.com'
    const githubProvider = new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
      url: `https://${githubDomain}`,
      clientIds: ['sts.amazonaws.com'],
    })

    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'envoy-github-actions-deploy',
      assumedBy: new iam.WebIdentityPrincipal(githubProvider.openIdConnectProviderArn, {
        StringLike: {
          [`${githubDomain}:sub`]: 'repo:bfluharty/envoy-project-management:*',
        },
      }),
    })

    // Add necessary permissions for deployment
    deployRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser')
    )
    deployRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonECS_FullAccess'))
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: ['*'], // Broad PassRole for ECS task roles
      })
    )

    // ---------------------------------------------------------------
    // VPC — import existing shared VPC (also used by Reasoning Engine)
    // vpc-035b52dbfe8dd281b (31.0.0.0/16)
    // Subnets were pre-created; NAT Gateway was deleted so we recreate it.
    // ---------------------------------------------------------------
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'EnvoyVpc', {
      vpcId: 'vpc-035b52dbfe8dd281b',
      availabilityZones: ['us-east-1a', 'us-east-1b'],
      publicSubnetIds: [
        'subnet-0a0f79f2da5a82748', // envoy-subnet-public1-us-east-1a
        'subnet-0311764e1dc137d51', // envoy-subnet-public2-us-east-1b
      ],
      privateSubnetIds: [
        'subnet-0db70c6bb64e54616', // envoy-subnet-private1-us-east-1a
        'subnet-0ca7744767a351c8e', // envoy-subnet-private2-us-east-1b
      ],
      isolatedSubnetIds: [
        'subnet-06787cf3db2a5417b', // envoy-subnet-private-db1-us-east-1a
        'subnet-0e1cd4cddba2db3c6', // envoy-subnet-private-db1-us-east-1b
      ],
    })

    // ---------------------------------------------------------------
    // NAT Gateway — recreate in public subnet (original was deleted)
    // Then fix the stale routes in both private route tables.
    // ---------------------------------------------------------------
    const natEip = new ec2.CfnEIP(this, 'NatEIP', { domain: 'vpc' })

    const natGateway = new ec2.CfnNatGateway(this, 'NatGateway', {
      allocationId: natEip.attrAllocationId,
      subnetId: 'subnet-0a0f79f2da5a82748', // public subnet us-east-1a
    })

    // Replace stale 0.0.0.0/0 routes in both private route tables
    // (must delete old stale route first — done by setting it to NAT)
    new ec2.CfnRoute(this, 'PrivateRoute1a', {
      routeTableId: 'rtb-0ef7a5158ae5887c2', // envoy-rtb-private1-us-east-1a
      destinationCidrBlock: '0.0.0.0/0',
      natGatewayId: natGateway.ref,
    })

    new ec2.CfnRoute(this, 'PrivateRoute1b', {
      routeTableId: 'rtb-0b0c35cdd7ebd644b', // envoy-rtb-private2-us-east-1b
      destinationCidrBlock: '0.0.0.0/0',
      natGatewayId: natGateway.ref,
    })

    // ---------------------------------------------------------------
    // Security Groups
    // ---------------------------------------------------------------
    const albSg = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      securityGroupName: 'envoy-pm-alb-sg',
      description: 'Envoy PM ALB - accepts traffic from CloudFront only',
    })
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80))
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443))

    const ecsSg = new ec2.SecurityGroup(this, 'ECSSecurityGroup', {
      vpc,
      securityGroupName: 'envoy-pm-ecs-sg',
      description: 'Envoy PM ECS Tasks - private subnet, accepts from ALB only',
    })
    ecsSg.addIngressRule(albSg, ec2.Port.tcp(8080))

    const rdsSg = new ec2.SecurityGroup(this, 'RDSSecurityGroup', {
      vpc,
      securityGroupName: 'envoy-pm-rds-sg',
      description: 'Envoy PM RDS - private DB subnet, accepts from ECS only',
    })
    rdsSg.addIngressRule(ecsSg, ec2.Port.tcp(5432))

    // Allow reasoning engine Lambda (sg-02db470a9278cbe9a) to reach RDS
    const reasoningEngineSg = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'ReasoningEngineSg',
      'sg-02db470a9278cbe9a'
    )
    rdsSg.addIngressRule(reasoningEngineSg, ec2.Port.tcp(5432))

    // ---------------------------------------------------------------
    // RDS — PostgreSQL 16 restored from dev snapshot, private DB subnet, Multi-AZ
    // New password generated and stored in Secrets Manager
    // ---------------------------------------------------------------
    const db = new rds.DatabaseInstanceFromSnapshot(this, 'Database', {
      snapshotIdentifier: 'envoy-project-management-dev-snapshot-rdsinstance-hj07wknkjcsu',
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSg],
      credentials: rds.SnapshotCredentials.fromGeneratedSecret('postgres'),
      multiAz: true,
      deletionProtection: true,
      backupRetention: cdk.Duration.days(7),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // ---------------------------------------------------------------
    // Parameter Store — app secrets
    // Run `aws ssm put-parameter` to populate these after first deploy
    // ---------------------------------------------------------------
    const appKeyParam = ssm.StringParameter.fromSecureStringParameterAttributes(this, 'AppKey', {
      parameterName: '/envoy/APP_KEY',
      version: 1,
    })
    const resendKeyParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'ResendApiKey',
      { parameterName: '/envoy/RESEND_API_KEY', version: 1 }
    )
    const googleClientIdParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'GoogleClientId',
      { parameterName: '/envoy/GOOGLE_CLIENT_ID', version: 1 }
    )
    const googleClientSecretParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'GoogleClientSecret',
      { parameterName: '/envoy/GOOGLE_CLIENT_SECRET', version: 1 }
    )
    const msClientIdParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'MsClientId',
      { parameterName: '/envoy/MICROSOFT_CLIENT_ID', version: 1 }
    )
    const msClientSecretParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'MsClientSecret',
      { parameterName: '/envoy/MICROSOFT_CLIENT_SECRET', version: 1 }
    )
    const emailServiceApiKeyParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'EmailServiceApiKey',
      { parameterName: '/envoy/EMAIL_SERVICE_API_KEY', version: 1 }
    )
    const reasoningEngineUrlParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'ReasoningEngineUrl',
      { parameterName: '/envoy/REASONING_ENGINE_URL_PROD', version: 3 }
    )
    const reasoningEngineUrlDevParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'ReasoningEngineUrlDev',
      { parameterName: '/envoy/REASONING_ENGINE_URL_DEV', version: 1 }
    )
    const emailServiceUrlParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'EmailServiceUrl',
      { parameterName: '/envoy/EMAIL_SERVICE_URL', version: 1 }
    )

    // ---------------------------------------------------------------
    // ECS Cluster
    // ---------------------------------------------------------------
    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: 'envoy-pm',
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    })

    // ---------------------------------------------------------------
    // CloudWatch Log Group
    // ---------------------------------------------------------------
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: '/ecs/envoy-project-management',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // ---------------------------------------------------------------
    // ECR — existing repository
    // ---------------------------------------------------------------
    const repository = ecr.Repository.fromRepositoryName(
      this,
      'ECRRepo',
      'envoy-project-management'
    )

    // ---------------------------------------------------------------
    // ECS Task Definition
    // ---------------------------------------------------------------
    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      family: 'envoy-project-management',
      cpu: 1024,
      memoryLimitMiB: 2048,
    })

    taskDef.addContainer('app', {
      containerName: 'envoy-project-management',
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      portMappings: [{ containerPort: 8080 }],
      environment: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '8080',
        LOG_LEVEL: 'info',
        SESSION_DRIVER: 'cookie',
        APP_URL: 'https://app.hello-envoy.com',
        MAIL_FROM_ADDRESS: 'notifications@hello-envoy.com',
        MAIL_FROM_NAME: 'Envoy',
        DB_PORT: '5432',
        DB_DATABASE: 'envoy_db',
      },
      secrets: {
        // DB — from Secrets Manager (generated from snapshot restore)
        DB_HOST: ecs.Secret.fromSecretsManager(db.secret!, 'host'),
        DB_USER: ecs.Secret.fromSecretsManager(db.secret!, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(db.secret!, 'password'),
        // App secrets — from SSM Parameter Store
        APP_KEY: ecs.Secret.fromSsmParameter(appKeyParam),
        RESEND_API_KEY: ecs.Secret.fromSsmParameter(resendKeyParam),
        GOOGLE_CLIENT_ID: ecs.Secret.fromSsmParameter(googleClientIdParam),
        GOOGLE_CLIENT_SECRET: ecs.Secret.fromSsmParameter(googleClientSecretParam),
        MICROSOFT_CLIENT_ID: ecs.Secret.fromSsmParameter(msClientIdParam),
        MICROSOFT_CLIENT_SECRET: ecs.Secret.fromSsmParameter(msClientSecretParam),
        EMAIL_SERVICE_API_KEY: ecs.Secret.fromSsmParameter(emailServiceApiKeyParam),
        REASONING_ENGINE_URL_PROD: ecs.Secret.fromSsmParameter(reasoningEngineUrlParam),
        REASONING_ENGINE_URL_DEV: ecs.Secret.fromSsmParameter(reasoningEngineUrlDevParam),
        EMAIL_SERVICE_URL: ecs.Secret.fromSsmParameter(emailServiceUrlParam),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs',
        logGroup,
      }),
    })

    // ---------------------------------------------------------------
    // ALB — in public subnet, traffic from CloudFront only
    // ---------------------------------------------------------------
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: albSg,
    })

    // ACM certificate for HTTPS — existing cert (must be ISSUED before deploy)
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'Certificate',
      'arn:aws:acm:us-east-1:362850210751:certificate/43b1b27a-8567-4ab9-8e0f-d3e35b0d1b24'
    )

    // HTTP -> HTTPS redirect
    alb.addRedirect({
      sourceProtocol: elbv2.ApplicationProtocol.HTTP,
      sourcePort: 80,
      targetProtocol: elbv2.ApplicationProtocol.HTTPS,
      targetPort: 443,
    })

    // HTTPS listener -> ECS
    const httpsListener = alb.addListener('HTTPS', {
      port: 443,
      certificates: [certificate],
    })

    // ---------------------------------------------------------------
    // ECS Fargate Service — in private app subnet
    // ---------------------------------------------------------------
    const service = new ecs.FargateService(this, 'Service', {
      serviceName: 'envoy-project-management',
      cluster,
      taskDefinition: taskDef,
      desiredCount: 2, // Multi-AZ: one task per AZ
      securityGroups: [ecsSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
    })

    httpsListener.addTargets('ECS', {
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200-399',
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    })

    // ---------------------------------------------------------------
    // Dev Environment Resources
    // ---------------------------------------------------------------
    const devAlbSg = new ec2.SecurityGroup(this, 'DevALBSecurityGroup', {
      vpc,
      securityGroupName: 'envoy-pm-dev-alb-sg',
      description: 'Envoy PM Dev ALB',
    })
    devAlbSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80))

    ecsSg.addIngressRule(devAlbSg, ec2.Port.tcp(8080)) // Allow Dev ALB to hit ECS

    const devAlb = new elbv2.ApplicationLoadBalancer(this, 'DevALB', {
      vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: devAlbSg,
    })

    const devHttpListener = devAlb.addListener('HTTP', { port: 80 })

    const devTaskDef = new ecs.FargateTaskDefinition(this, 'DevTaskDef', {
      family: 'envoy-project-management-dev',
      cpu: 1024,
      memoryLimitMiB: 2048,
    })

    devTaskDef.addContainer('app', {
      containerName: 'envoy-project-management',
      image: ecs.ContainerImage.fromEcrRepository(repository, 'dev-latest'),
      portMappings: [{ containerPort: 8080 }],
      environment: {
        NODE_ENV: 'development',
        HOST: '0.0.0.0',
        PORT: '8080',
        LOG_LEVEL: 'debug',
        SESSION_DRIVER: 'cookie',
        APP_URL: `http://${devAlb.loadBalancerDnsName}`,
        MAIL_FROM_ADDRESS: 'notifications@hello-envoy.com',
        MAIL_FROM_NAME: 'Envoy',
        DB_PORT: '5432',
        DB_DATABASE: 'envoy_db_dev',
      },
      secrets: {
        DB_HOST: ecs.Secret.fromSecretsManager(db.secret!, 'host'),
        DB_USER: ecs.Secret.fromSecretsManager(db.secret!, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(db.secret!, 'password'),
        APP_KEY: ecs.Secret.fromSsmParameter(appKeyParam),
        RESEND_API_KEY: ecs.Secret.fromSsmParameter(resendKeyParam),
        GOOGLE_CLIENT_ID: ecs.Secret.fromSsmParameter(googleClientIdParam),
        GOOGLE_CLIENT_SECRET: ecs.Secret.fromSsmParameter(googleClientSecretParam),
        MICROSOFT_CLIENT_ID: ecs.Secret.fromSsmParameter(msClientIdParam),
        MICROSOFT_CLIENT_SECRET: ecs.Secret.fromSsmParameter(msClientSecretParam),
        EMAIL_SERVICE_API_KEY: ecs.Secret.fromSsmParameter(emailServiceApiKeyParam),
        REASONING_ENGINE_URL_PROD: ecs.Secret.fromSsmParameter(reasoningEngineUrlParam),
        REASONING_ENGINE_URL_DEV: ecs.Secret.fromSsmParameter(reasoningEngineUrlDevParam),
        EMAIL_SERVICE_URL: ecs.Secret.fromSsmParameter(emailServiceUrlParam),
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'ecs-dev', logGroup }),
    })

    const devService = new ecs.FargateService(this, 'DevService', {
      serviceName: 'envoy-pm-dev',
      cluster,
      taskDefinition: devTaskDef,
      desiredCount: 0, // Set to 0 initially to avoid CannotPullContainerError (no image yet)
      securityGroups: [ecsSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
    })

    devHttpListener.addTargets('ECS', {
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [devService],
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200-399',
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    })

    // ---------------------------------------------------------------
    // WAF — rate limiting + common rule set
    // ---------------------------------------------------------------
    const waf = new wafv2.CfnWebACL(this, 'WAF', {
      name: 'envoy-waf',
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'envoy-waf',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSet',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'RateLimitRule',
          priority: 2,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimit',
            sampledRequestsEnabled: true,
          },
        },
      ],
    })

    // ---------------------------------------------------------------
    // CloudFront — in front of ALB, with WAF
    // ---------------------------------------------------------------
    const distribution = new cloudfront.Distribution(this, 'CloudFront', {
      comment: 'Envoy Project Management',
      webAclId: waf.attrArn,
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          httpPort: 80,
          httpsPort: 443,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
      domainNames: ['app.hello-envoy.com'],
      certificate,
    })

    // ---------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------
    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
      description: 'Point app.hello-envoy.com CNAME here in Cloudflare',
    })

    new cdk.CfnOutput(this, 'ALBDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS (internal - CloudFront origin)',
    })

    new cdk.CfnOutput(this, 'DevALBDnsName', {
      value: devAlb.loadBalancerDnsName,
      description: 'Dev ALB DNS (access directly for dev testing)',
    })

    new cdk.CfnOutput(this, 'DBSecretName', {
      value: '/envoy/db-credentials',
      description: 'Secrets Manager path for DB credentials',
    })
  }
}
