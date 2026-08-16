export const ANALYSIS_SYSTEM_PROMPT = `You are a workflow analysis AI for Shamsu, an AI-powered no-code API creation platform. Your role is to analyze recorded browser interactions and extract meaningful workflow patterns.

Key capabilities:
- Identify user intent from click sequences
- Map interactive elements (buttons, inputs, links, selects)
- Detect data extraction opportunities
- Suggest improvements for reliability

Always respond in valid JSON format. Be concise but thorough.`;

export const ANALYSIS_USER_PROMPT = (
  events: any[],
  pageUrl: string,
  pageTitle: string
) => `Analyze this recorded browser workflow:

**Page Context:**
- URL: ${pageUrl}
- Title: ${pageTitle}

**Recorded Events:**
${JSON.stringify(events, null, 2)}

**Required Output Format (JSON):**
{
  "goal": "Primary objective of this workflow",
  "steps": [
    {
      "order": 1,
      "action": "CLICK|INPUT|NAVIGATE|SELECT|SCROLL|WAIT",
      "target": "Element description",
      "selector": "CSS selector used",
      "value": "Input value if applicable",
      "purpose": "Why this step exists"
    }
  ],
  "patterns": ["Repeated patterns detected"],
  "extractableFields": [
    {
      "name": "Field name",
      "selector": "CSS selector",
      "type": "text|number|url|email|date",
      "description": "What this field contains"
    }
  ],
  "suggestions": ["Improvement suggestions"],
  "estimatedComplexity": "low|medium|high",
  "estimatedDuration": "Estimated execution time in seconds"
}`;

export const HEALING_VISION_PROMPT = (
  intent: string,
  context: string,
  failedSelector: string
) => `You are an element locator AI for web automation. A step in a workflow failed to find its target element.

**Intent:** ${intent}
**Context:** ${context}
**Failed Selector:** ${failedSelector}

**Task:** Analyze the screenshot and identify the element the user intends to interact with.

**Respond with JSON:**
{
  "found": true|false,
  "confidence": 0.0-1.0,
  "selector": "Best CSS selector for the element",
  "alternativeSelectors": ["backup1", "backup2"],
  "reasoning": "Why you chose this selector",
  "coordinates": {"x": 123, "y": 456} | null
}

Focus on stable selectors: data-testid, aria-label, unique text, or structural position. Avoid brittle selectors like nth-child or dynamic classes.`;

export const HEALING_AGENT_PROMPT = (
  intent: string,
  context: string,
  pageState: string
) => `You are a web automation agent. The previous attempt to find an element failed.

**Goal:** ${intent}
**Context:** ${context}
**Current Page State:** ${pageState}

**Instructions:**
1. Analyze the current page state
2. Identify the element that matches the intent
3. Return exactly ONE action to take

**Respond with JSON:**
{
  "action": "CLICK|INPUT|SCROLL|WAIT|NAVIGATE",
  "selector": "CSS selector for the target element",
  "value": "Input value if INPUT action",
  "reasoning": "Why this action",
  "confidence": 0.0-1.0
}

Rules:
- Only suggest ONE action per response
- Use stable selectors (test-id, aria-label, text content)
- If element is not visible, suggest SCROLL first
- If uncertain, set confidence below 0.7`;

export const WORKFLOW_OPTIMIZATION_PROMPT = (workflow: any) => `Analyze this workflow and suggest optimizations:

${JSON.stringify(workflow, null, 2)}

**Respond with JSON:**
{
  "redundantSteps": [indices of unnecessary steps],
  "optimizationSuggestions": [
    {
      "stepIndex": 0,
      "suggestion": "What to change",
      "reason": "Why this is better"
    }
  ],
  "estimatedTimeSaved": "Time saved in seconds",
  "riskAssessment": "low|medium|high"
}`;

export const EXTRACTION_PATTERN_PROMPT = (pageHtml: string) => `Analyze this HTML and identify data extraction patterns:

${pageHtml.substring(0, 5000)}

**Respond with JSON:**
{
  "tables": [
    {
      "selector": "CSS selector for table",
      "columns": ["col1", "col2"],
      "rowCount": 10
    }
  ],
  "lists": [
    {
      "selector": "CSS selector for list",
      "itemSelector": "CSS selector for each item",
      "itemCount": 5
    }
  ],
  "cards": [
    {
      "containerSelector": "CSS selector for card container",
      "fields": {
        "title": "h3.selector",
        "description": "p.selector",
        "price": "span.selector"
      }
    }
  ]
}`;
