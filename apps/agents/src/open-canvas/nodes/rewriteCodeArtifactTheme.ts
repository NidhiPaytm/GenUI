import { v4 as uuidv4 } from "uuid";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  extractThinkingAndResponseTokens,
  isThinkingModel,
} from "@opencanvas/shared/utils/thinking";
import {
  isArtifactCodeContent,
  getArtifactContent,
} from "@opencanvas/shared/utils/artifacts";
import { ArtifactV3, Reflections } from "@opencanvas/shared/types";
import {
  ensureStoreInConfig,
  formatReflections,
  getModelConfig,
  getModelFromConfig,
} from "@/utils";
import {
  ADD_COMMENTS_TO_CODE_ARTIFACT_PROMPT,
  ADD_LOGS_TO_CODE_ARTIFACT_PROMPT,
  FIX_BUGS_CODE_ARTIFACT_PROMPT,
  PORT_LANGUAGE_CODE_ARTIFACT_PROMPT,
} from "../prompts";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state";
import { AIMessage } from "@langchain/core/messages";
import { SimpleLLMLogger, extractSystemPrompt, extractUserPrompt, extractOutputContent, extractRequestInfo } from "../utils/llm-logger";

export const rewriteCodeArtifactTheme = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const startTime = Date.now();
  const requestInfo = extractRequestInfo(config);
  const { modelName } = getModelConfig(config);
  const smallModel = await getModelFromConfig(config);

  const store = ensureStoreInConfig(config);
  const assistantId = config.configurable?.assistant_id;
  if (!assistantId) {
    throw new Error("`assistant_id` not found in configurable");
  }
  const memoryNamespace = ["memories", assistantId];
  const memoryKey = "reflection";
  const memories = await store.get(memoryNamespace, memoryKey);
  const memoriesAsString = memories?.value
    ? formatReflections(memories.value as Reflections)
    : "No reflections found.";

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;
  if (!currentArtifactContent) {
    throw new Error("No artifact found");
  }
  if (!isArtifactCodeContent(currentArtifactContent)) {
    throw new Error("Current artifact content is not code");
  }

  let formattedPrompt = "";
  let actionType = "";
  if (state.addComments) {
    formattedPrompt = ADD_COMMENTS_TO_CODE_ARTIFACT_PROMPT.replace(
      "{artifactContent}",
      currentArtifactContent.code
    );
    actionType = "add_comments";
  } else if (state.addLogs) {
    formattedPrompt = ADD_LOGS_TO_CODE_ARTIFACT_PROMPT.replace(
      "{artifactContent}",
      currentArtifactContent.code
    );
    actionType = "add_logs";
  } else if (state.fixBugs) {
    formattedPrompt = FIX_BUGS_CODE_ARTIFACT_PROMPT.replace(
      "{artifactContent}",
      currentArtifactContent.code
    );
    actionType = "fix_bugs";
  } else if (state.portLanguage) {
    formattedPrompt = PORT_LANGUAGE_CODE_ARTIFACT_PROMPT.replace(
      "{artifactContent}",
      currentArtifactContent.code
    ).replace("{newLanguage}", state.portLanguage);
    actionType = `port_to_${state.portLanguage}`;
  } else {
    throw new Error("No code rewrite action selected");
  }

  formattedPrompt = formattedPrompt.replace("{reflections}", memoriesAsString);

  const messages = [
    { role: "user", content: formattedPrompt },
  ];

  let newArtifactValues;
  let error;
  try {
    newArtifactValues = await smallModel.invoke(messages);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    const duration = Date.now() - startTime;

    // Log the LLM call
    await SimpleLLMLogger.logLLMStep(
      "rewriteCodeArtifactTheme",
      extractSystemPrompt(messages),
      extractUserPrompt(messages),
      extractOutputContent(newArtifactValues),
      requestInfo
    );
  }

  let thinkingMessage: AIMessage | undefined;
  let artifactContentText = newArtifactValues.content as string;

  if (isThinkingModel(modelName)) {
    const { thinking, response } =
      extractThinkingAndResponseTokens(artifactContentText);
    thinkingMessage = new AIMessage({
      id: `thinking-${uuidv4()}`,
      content: thinking,
    });
    artifactContentText = response;
  }

  const newArtifact: ArtifactV3 = {
    ...state.artifact,
    currentIndex: state.artifact.contents.length + 1,
    contents: [
      ...state.artifact.contents,
      {
        ...currentArtifactContent,
        index: state.artifact.contents.length + 1,
        code: artifactContentText,
      },
    ],
  };

  return {
    artifact: newArtifact,
    messages: [...(thinkingMessage ? [thinkingMessage] : [])],
    _messages: [...(thinkingMessage ? [thinkingMessage] : [])],
  };
};
