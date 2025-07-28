import { v4 as uuidv4 } from "uuid";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  extractThinkingAndResponseTokens,
  isThinkingModel,
} from "@opencanvas/shared/utils/thinking";
import {
  isArtifactMarkdownContent,
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
  ADD_EMOJIS_TO_ARTIFACT_PROMPT,
  CHANGE_ARTIFACT_LANGUAGE_PROMPT,
  CHANGE_ARTIFACT_LENGTH_PROMPT,
  CHANGE_ARTIFACT_READING_LEVEL_PROMPT,
  CHANGE_ARTIFACT_TO_PIRATE_PROMPT,
} from "../prompts";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state";
import { AIMessage } from "@langchain/core/messages";
import { SimpleLLMLogger, extractSystemPrompt, extractUserPrompt, extractOutputContent, extractRequestInfo } from "../utils/llm-logger";

export const rewriteArtifactTheme = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const startTime = Date.now();
  const { modelName } = getModelConfig(config);
  const smallModel = await getModelFromConfig(config);

  // Extract request info for logging
  const requestInfo = extractRequestInfo(config);

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
  if (!isArtifactMarkdownContent(currentArtifactContent)) {
    throw new Error("Current artifact content is not markdown");
  }

  let formattedPrompt = "";
  let themeType = "";
  if (state.language) {
    formattedPrompt = CHANGE_ARTIFACT_LANGUAGE_PROMPT.replace(
      "{newLanguage}",
      state.language
    ).replace("{artifactContent}", currentArtifactContent.fullMarkdown);
    themeType = `language_${state.language}`;
  } else if (state.readingLevel && state.readingLevel !== "pirate") {
    let newReadingLevel = "";
    switch (state.readingLevel) {
      case "child":
        newReadingLevel = "elementary school student";
        break;
      case "teenager":
        newReadingLevel = "high school student";
        break;
      case "college":
        newReadingLevel = "college student";
        break;
      case "phd":
        newReadingLevel = "PhD student";
        break;
    }
    formattedPrompt = CHANGE_ARTIFACT_READING_LEVEL_PROMPT.replace(
      "{newReadingLevel}",
      newReadingLevel
    ).replace("{artifactContent}", currentArtifactContent.fullMarkdown);
    themeType = `reading_level_${state.readingLevel}`;
  } else if (state.readingLevel && state.readingLevel === "pirate") {
    formattedPrompt = CHANGE_ARTIFACT_TO_PIRATE_PROMPT.replace(
      "{artifactContent}",
      currentArtifactContent.fullMarkdown
    );
    themeType = "pirate";
  } else if (state.artifactLength) {
    let newLength = "";
    switch (state.artifactLength) {
      case "shortest":
        newLength = "much shorter than it currently is";
        break;
      case "short":
        newLength = "slightly shorter than it currently is";
        break;
      case "long":
        newLength = "slightly longer than it currently is";
        break;
      case "longest":
        newLength = "much longer than it currently is";
        break;
    }
    formattedPrompt = CHANGE_ARTIFACT_LENGTH_PROMPT.replace(
      "{newLength}",
      newLength
    ).replace("{artifactContent}", currentArtifactContent.fullMarkdown);
    themeType = `length_${state.artifactLength}`;
  } else if (state.regenerateWithEmojis) {
    formattedPrompt = ADD_EMOJIS_TO_ARTIFACT_PROMPT.replace(
      "{artifactContent}",
      currentArtifactContent.fullMarkdown
    );
    themeType = "emojis";
  } else {
    throw new Error("No theme selected");
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
    // Log the LLM call with request info
    await SimpleLLMLogger.logLLMStep(
      "rewriteArtifactTheme",
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
        fullMarkdown: artifactContentText,
      },
    ],
  };

  return {
    artifact: newArtifact,
    messages: [...(thinkingMessage ? [thinkingMessage] : [])],
    _messages: [...(thinkingMessage ? [thinkingMessage] : [])],
  };
};
