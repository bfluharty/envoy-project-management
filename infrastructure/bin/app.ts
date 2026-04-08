#!/usr/bin/env node
import 'aws-cdk-lib/aws-s3'
import * as cdk from 'aws-cdk-lib'
import { EnvoyStack } from '../lib/envoy_stack'

const app = new cdk.App()

new EnvoyStack(app, 'EnvoyStack', {
  env: {
    account: '362850210751',
    region: 'us-east-1',
  },
})
