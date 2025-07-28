import { z } from "zod";
import { OpenCanvasGraphAnnotation } from "../../state";
import { getRequirementsContext, optionallyGetSystemPromptFromConfig, getFormattedReflections, getModelFromConfig } from "@/utils";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { webDSLSchema } from "./schemas";
import { validateState } from "../rewrite-artifact/utils";
import { buildPrompt } from "./utils";
import { isArtifactMarkdownContent } from "@opencanvas/shared/utils/artifacts";
import { ChatAnthropic } from "@langchain/anthropic";
import { SimpleLLMLogger, extractSystemPrompt, extractUserPrompt, extractOutputContent, extractRequestInfo } from "@/open-canvas/utils/llm-logger";

// Define type from schema for TypeScript type checking
type WebDSL = z.infer<typeof webDSLSchema>;

/**
 * Takes requirements analysis and generates a detailed web DSL using an LLM.
 *
 * @param state The current graph state, expected to contain 'requirementsAnalysis'.
 * @returns A partial state update with the generated 'webDSL'.
 */
export async function generateWebDSL(
    state: typeof OpenCanvasGraphAnnotation.State,
    config: LangGraphRunnableConfig
): Promise<Partial<typeof OpenCanvasGraphAnnotation.State>> {
    const requestInfo = extractRequestInfo(config);
    const model = await getModelFromConfig(config);

    const modelWithTool = model.withStructuredOutput(webDSLSchema);

    const { currentArtifactContent, recentHumanMessage } = validateState(state);

    const memoriesAsString = await getFormattedReflections(config);
    const artifactContent = isArtifactMarkdownContent(currentArtifactContent)
        ? currentArtifactContent.fullMarkdown
        : currentArtifactContent.code;

    const requirements = getRequirementsContext(state.analyzedRequirements);
    const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
    const formattedPrompt = buildPrompt({
        artifactContent: artifactContent,
        memoriesAsString: memoriesAsString,
        requirementsAnalysis: requirements
    });

    const fullSystemPrompt = userSystemPrompt ? `${userSystemPrompt}\n${formattedPrompt}` : formattedPrompt;

    const messages = [
        { role: "system", content: fullSystemPrompt },
        recentHumanMessage
    ];

    let generatedDSL: WebDSL | undefined;
    try {
        const stream = await modelWithTool.stream(messages);
        for await (const chunk of stream) {
            generatedDSL = chunk;
        }

        // Log the LLM call with simplified format
        await SimpleLLMLogger.logLLMStep(
            "generateWebDSL",
            extractSystemPrompt(messages),
            extractUserPrompt(messages),
            extractOutputContent(generatedDSL),
            requestInfo
        );
    } catch (e) {
        console.error("Error generating or parsing Web DSL:", e);
        return {};
    }

    if (!generatedDSL) {
        return {};
    }

    // Return the update to the state with the generated DSL
    return {
        webDSL: generatedDSL,
    };
}
