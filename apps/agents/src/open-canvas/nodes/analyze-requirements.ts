import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
    getArtifactContent,
} from "@opencanvas/shared/utils/artifacts";
import {
    formatArtifactContentWithTemplate,
    getFormattedReflections,
} from "@/utils";
import { REQUIREMENTS_ANALYSIS_PROMPT, CURRENT_ARTIFACT_PROMPT } from "../prompts";
import {
    OpenCanvasGraphAnnotation,
    OpenCanvasGraphReturnType,
} from "../state";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { SimpleLLMLogger, extractSystemPrompt, extractUserPrompt, extractOutputContent, extractRequestInfo } from "../utils/llm-logger";

const requirementsAnalysisSchema = z.object({
    mainGoal: z.string().describe("The main goal or objective of the HTML page to be created"),
    keyFeatures: z.array(z.string()).describe("Key features and components of the HTML page, including layout structure, navigation, and main content areas"),
    technicalRequirements: z.array(z.string()).describe("Technical requirements including HTML structure, CSS styling, JavaScript functionality, and any required libraries or frameworks"),
    preferences: z.array(z.string()).describe("Design preferences including color schemes, typography, spacing, animations, and overall visual style"),
    considerations: z.array(z.string()).describe("Accessibility requirements, responsive design breakpoints, cross-browser compatibility, performance optimization, and other technical considerations"),
    uiComponents: z.array(z.string()).describe("Detailed UI components needed, including buttons, forms, cards, modals, navigation elements, and other interactive elements"),
    interactions: z.array(z.string()).describe("Specific user interactions and behaviors, including hover effects, click actions, form validations, animations, and transitions"),
    dataVisualization: z.array(z.string()).describe("Data visualization requirements, including charts, graphs, tables, or other data display components if needed"),
    responsiveLayouts: z.array(z.string()).describe("Responsive design requirements for different screen sizes and devices"),
    accessibilityFeatures: z.array(z.string()).describe("Accessibility features including ARIA attributes, keyboard navigation, screen reader support, and color contrast requirements"),
});

export const analyzeRequirements = async (
    state: typeof OpenCanvasGraphAnnotation.State,
    config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
    const requestInfo = extractRequestInfo(config);
    const modelWithTool = new ChatOpenAI({
        model: "gpt-4o-mini",
        temperature: 0.6,
    }).withStructuredOutput(requirementsAnalysisSchema);

    const currentArtifactContent = state.artifact
        ? getArtifactContent(state.artifact)
        : undefined;

    const memoriesAsString = await getFormattedReflections(config);

    // Format the prompt with the actual values
    const formattedPrompt = REQUIREMENTS_ANALYSIS_PROMPT
        .replace("{reflections}", memoriesAsString)
        .replace("{recentArtifact}", currentArtifactContent ? formatArtifactContentWithTemplate(
            CURRENT_ARTIFACT_PROMPT,
            currentArtifactContent
        ) : "No artifact found");

    const recentHumanMessage = state._messages.findLast(
        (message) => message.getType() === "human"
    );
    if (!recentHumanMessage) {
        throw new Error("No recent human message found");
    }

    // console.log("formattedPrompt", formattedPrompt);

    const messages = [
        {
            role: "system",
            content: formattedPrompt,
        },
        recentHumanMessage,
    ];

    let response;
    try {
        response = await modelWithTool.invoke(messages);

        // Log the LLM call with simplified format
        await SimpleLLMLogger.logLLMStep(
            "analyzeRequirements",
            extractSystemPrompt(messages),
            extractUserPrompt(messages),
            extractOutputContent(response),
            requestInfo
        );
    } catch (e) {
        console.error("Error in analyzeRequirements:", e);
        throw e;
    }

    const analyzedRequirements = response;

    console.log("analyzedRequirements", analyzedRequirements);

    // Return the analyzed requirements in the expected format
    return {
        analyzedRequirements: {
            mainGoal: analyzedRequirements?.mainGoal || "",
            keyFeatures: analyzedRequirements?.keyFeatures || [],
            technicalRequirements: analyzedRequirements?.technicalRequirements || [],
            preferences: analyzedRequirements?.preferences || [],
            considerations: analyzedRequirements?.considerations || [],
            uiComponents: analyzedRequirements?.uiComponents || [],
            interactions: analyzedRequirements?.interactions || [],
            dataVisualization: analyzedRequirements?.dataVisualization || [],
            responsiveLayouts: analyzedRequirements?.responsiveLayouts || [],
            accessibilityFeatures: analyzedRequirements?.accessibilityFeatures || [],
        }
    };
}; 