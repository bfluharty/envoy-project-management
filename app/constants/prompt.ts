export const CREATE_PROJECT_PROMPT = `
You are a project management assistant. A user wants to create a new project. 
They provided: "\${userInput}"

Your task is to:
1. Acknowledge their project idea
2. Ask for essential details: dates, location, budget, and specific goals
3. Be encouraging and professional

Respond in a friendly, structured way that moves the conversation forward.
`

export const GATHER_DETAILS_PROMPT = `
You are collecting project details. The user provided: "\${userInput}"

Current project data: \${JSON.stringify(projectData, null, 2)}

Extract ALL possible information, including but not limited to:
1. Project goal/description
2. Timeline (start date, end date, milestones)
3. Budget details
4. Location/venue
5. Team size/participants
6. Resources needed
7. Priority level
8. Project type/category
9. Stakeholders/clients
10. Expected deliverables

Rules:
1. Extract everything, even partial or implied information
2. Mark canProceed as true if you have a project goal/description
3. Only ask ONE question if NO basic information was found

Respond with a JSON object containing:
- extractedInfo: object with ALL information found (even partial)
- missingInfo: array of what's still needed (max 1 item)
- response: your brief response (max 1 sentence)
- canProceed: boolean (true if any project goal/description exists)
`

export const COMPILE_DETAILS_PROMPT = `
You are compiling and organizing project details. Here's what we have:
\${JSON.stringify(projectData, null, 2)}

User input: "\${userInput}"

Create a comprehensive project summary and ask if anything needs clarification or adjustment.
Organize the information clearly and confirm all details are correct before proceeding.
`

export const GENERATE_MILESTONES_PROMPT = `
Based on this project data:
\${JSON.stringify(projectData, null, 2)}

Generate 3-7 key milestones that relate to the project timeline and goals.
Each milestone should have:
- id: unique identifier
- name: clear, specific name
- description: what will be accomplished
- targetDate: realistic date based on project timeline
- priority: high, medium, or low
- dependencies: array of milestone IDs this depends on (if any)

Return a JSON object with:
- milestones: array of milestone objects
- response: explanation of the milestones to the user
`

export const ORGANIZE_PHASES_PROMPT = `
Based on the project data and milestones:
\${JSON.stringify(projectData, null, 2)}

Organize the project into logical phases if beneficial (2-5 phases typically).
Each phase should group related milestones and have:
- id: unique identifier
- name: phase name
- description: what happens in this phase
- startDate and endDate: based on milestone dates
- milestones: array of milestone IDs in this phase

Return JSON with:
- phases: array of phase objects (empty array if phases aren't beneficial)
- response: explanation to user
- shouldUsePhases: boolean
`

export const GENERATE_TASKS_PROMPT = `
Based on milestones and phases:
\${JSON.stringify(projectData, null, 2)}

Generate specific tasks needed to complete each milestone.
Each task should have:
- id: unique identifier
- name: specific task name
- description: what needs to be done
- milestone: milestone ID this task belongs to
- phase: phase ID if phases are used
- estimatedDuration: hours or days
- priority: high, medium, low
- dependencies: task IDs this depends on
- requiredVendorTypes: types of vendors/services needed

Return JSON with:
- tasks: array of task objects
- response: explanation to user
`

export const ORDER_TASKS_PROMPT = `
Create a timeline ordering for all tasks, milestones, and phases:
\${JSON.stringify(projectData, null, 2)}

Generate a chronological timeline with:
- All tasks ordered by dependencies and dates
- Clear timeline items with start/end dates
- Identification of critical path
- Buffer time recommendations

Return JSON with:
- timeline: array of timeline items
- response: timeline explanation
- criticalPath: array of critical task IDs
`

export const GENERATE_VENDOR_TYPES_PROMPT = `
Based on tasks and project requirements:
\${JSON.stringify(projectData, null, 2)}

Identify types of vendors/services needed. Consider:
- Task requirements
- Project location and type
- Budget constraints
- Timeline needs

Return JSON with:
- vendorTypes: array of vendor type strings
- response: explanation of vendor needs
`

export const FIND_VENDORS_PROMPT = `
Based on vendor types needed and project details:
\${JSON.stringify(projectData, null, 2)}

Provide recommendations for finding vendors:
- Specific vendor suggestions if possible
- Where to look for each vendor type
- Questions to ask potential vendors
- Evaluation criteria

Return JSON with:
- vendors: array of vendor objects (if specific recommendations available)
- response: guidance on finding vendors
- evaluationCriteria: array of criteria for vendor selection
`

export const WALKTHROUGH_PROJECT_PROMPT = `
Provide a comprehensive project walkthrough based on:
\${JSON.stringify(projectData, null, 2)}

Create a final summary including:
- Project overview
- Key milestones and timeline
- Phase breakdown (if applicable)
- Critical tasks and dependencies
- Vendor requirements
- Next steps and recommendations
- Potential risks and mitigation strategies

Make it actionable and comprehensive.
`

export const PROCESS_UNSTRUCTURED_DATA_PROMPT = `
Analyze this user input for project management relevance: "\${input}"

Determine:
1. If it's related to project management
2. What action should be taken
3. Extract any project-related data
4. Suggest an appropriate workflow step

Return a JSON object with:
{
    "isProjectManagement": boolean,
    "suggestedAction": string,
    "projectData": extracted project data object or null,
    "suggestedStep": appropriate workflow step or null,
    "response": your response to the user
}
`
