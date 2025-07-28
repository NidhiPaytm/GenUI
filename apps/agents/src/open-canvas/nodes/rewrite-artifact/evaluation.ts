import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import {
    OpenCanvasGraphAnnotation,
} from "../../state";
import { UI_EVALUATION_SCHEMA, DYNAMIC_EVALUATION_METRICS_SCHEMA } from "./schemas";
import {
    getRequirementsContext,
    getFormattedReflections,
    getModelFromConfig,
} from "@/utils";
import {
    validateState,
} from "./utils";
import { EVALUATION_PROMPT, EVALUATION_METRICS_PROMPT } from "../../prompts";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SimpleLLMLogger, extractSystemPrompt, extractUserPrompt, extractOutputContent, extractRequestInfo } from "@/open-canvas/utils/llm-logger";

export interface ArticleEvaluation {
    bestArticle: {
        id: string;
        content: string;
        score: number;
    };
    details: z.infer<typeof UI_EVALUATION_SCHEMA>;
    metrics: z.infer<typeof DYNAMIC_EVALUATION_METRICS_SCHEMA>;
}

export const evaluateArtifact = async (
    contents: { id: string, content: string }[],
    iteration: number,
    state: typeof OpenCanvasGraphAnnotation.State,
    config: LangGraphRunnableConfig
): Promise<ArticleEvaluation | null> => {
    const requestInfo = extractRequestInfo(config);
    const model = new ChatOpenAI({
        modelName: "gpt-4o",
        temperature: 0.2,
    });

    // Use the same model for metrics
    const metricsModel = await getModelFromConfig(config);

    const { recentHumanMessage } = validateState(state);

    const metricsModelWithTool = metricsModel.bindTools(
        [
            {
                name: "generate_metrics",
                description: "Generate evaluation metrics based on requirements",
                schema: DYNAMIC_EVALUATION_METRICS_SCHEMA,
            },
        ],
        {
            tool_choice: "generate_metrics",
        }
    );

    const requirementsContext = getRequirementsContext(state.analyzedRequirements);

    let metrics = null;
    let metricsRetries = 4;
    let metricsLastError = null;

    while (metricsRetries > 0) {
        const messages = [
            { role: "system", content: EVALUATION_METRICS_PROMPT.replace("{requirementsContext}", requirementsContext) },
            recentHumanMessage,
        ];
        let metricsResponse = null;
        try {
            metricsResponse = await metricsModelWithTool.invoke(messages);

            if (metricsResponse.tool_calls?.[0]?.args) {
                metrics = DYNAMIC_EVALUATION_METRICS_SCHEMA.parse(metricsResponse.tool_calls[0].args);
                break;
            }
        } catch (error) {
            metricsLastError = error;
        } finally {
            await SimpleLLMLogger.logLLMStep(
                `generateMetrics_iteration_${iteration}`,
                extractSystemPrompt(messages),
                extractUserPrompt(messages),
                extractOutputContent(metricsResponse),
                requestInfo
            );
        }
        metricsRetries--;
        if (metricsRetries > 0) {
            console.log(`Retrying metrics generation (${metricsRetries} attempts remaining)...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Add a small delay between retries
        }
    }

    if (!metrics) {
        console.error("Failed to generate metrics after all retries:", metricsLastError);
        metrics = {
            metrics: []
        };
    }

    // Now evaluate the articles using the generated metrics
    const modelWithTool = model.bindTools(
        [
            {
                name: "evaluate_artifact",
                description: "Compare and evaluate multiple articles",
                schema: UI_EVALUATION_SCHEMA,
            },
        ],
        {
            tool_choice: "evaluate_artifact",
        }
    );

    const memoriesAsString = await getFormattedReflections(config);

    // Format articles for prompt
    const articlesContent = contents.map(article =>
        `ARTICLE ID: ${article.id}\n\n${article.content}`
    ).join('\n\n---\n\n');

    // Add metrics to the evaluation prompt
    const metricsContext = metrics.metrics.map(m =>
        `- ${m.name} (weight: ${m.weight}): ${m.description}\n  Criteria:\n${m.criteria.map(c => `  * ${c}`).join('\n')}`
    ).join('\n');

    const fullSystemPrompt = EVALUATION_PROMPT
        .replace("{requirementsContext}", requirementsContext)
        .replace("{reflectionsContext}", memoriesAsString)
        .replace("{evaluationMetrics}", metricsContext)
        .replace("{articlesContent}", articlesContent);

    let retries = 6;
    let lastError = null;
    let evaluation = null;

    while (retries > 0) {
        const messages = [
            { role: "system", content: fullSystemPrompt },
            { role: "user", content: "Please evaluate and compare these articles according to the criteria." },
        ];
        try {
            evaluation = await modelWithTool.invoke(messages);

            console.log("evaluated", evaluation.tool_calls?.[0]?.args ? "success" : "failure, please retry");

            if (evaluation.tool_calls?.[0]?.args) {
                const result = UI_EVALUATION_SCHEMA.parse(evaluation.tool_calls[0].args);

                return {
                    bestArticle: {
                        id: result.bestArticle.articleId,
                        content: contents.find(article => article.id === result.bestArticle.articleId)?.content || "",
                        score: result.bestArticle.totalScore,
                    },
                    details: result,
                    metrics: metrics,
                };
            }

            retries--;
            if (retries > 0) {
                console.log(`Retrying evaluation (${retries} attempts remaining)...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Add a small delay between retries
            }
        } catch (error) {
            lastError = error;
            retries--;
            if (retries > 0) {
                console.log(`Error evaluating articles, retrying (${retries} attempts remaining)...`, error);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } finally {
            await SimpleLLMLogger.logLLMStep(
                `evaluateArtifact_iteration_${iteration}`,
                extractSystemPrompt(messages),
                extractUserPrompt(messages),
                extractOutputContent(evaluation),
                requestInfo
            );
        }
    }

    console.error("Error evaluating articles after all retries:", lastError);

    return null;
}; 