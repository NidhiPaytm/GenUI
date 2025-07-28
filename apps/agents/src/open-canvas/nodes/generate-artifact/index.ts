import {
  createContextDocumentMessages,
  getFormattedReflections,
  getModelConfig,
  getModelFromConfig,
  isUsingO1MiniModel,
  optionallyGetSystemPromptFromConfig,
} from "@/utils";
import { ArtifactV3 } from "@opencanvas/shared/types";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../../state";
import { ARTIFACT_TOOL_SCHEMA } from "./schemas";
import { createArtifactContent, formatNewArtifactPrompt } from "./utils";
import { z } from "zod";

/**
 * Generate a new artifact based on the user's query.
 */
export const generateArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const { modelName } = getModelConfig(config, {
    isToolCalling: true,
  });
  const smallModel = await getModelFromConfig(config, {
    temperature: 0.5,
    isToolCalling: true,
  });

  const modelWithArtifactTool = smallModel.bindTools(
    [
      {
        name: "generate_artifact",
        description: ARTIFACT_TOOL_SCHEMA.description,
        schema: ARTIFACT_TOOL_SCHEMA,
      },
    ],
    {
      tool_choice: "generate_artifact",
    }
  );

  const memoriesAsString = await getFormattedReflections(config);
  const formattedNewArtifactPrompt = formatNewArtifactPrompt(
    memoriesAsString,
    modelName
  );

  const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
  const fullSystemPrompt = userSystemPrompt
    ? `${userSystemPrompt}\n${formattedNewArtifactPrompt}`
    : formattedNewArtifactPrompt;

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);

  // Add requirements analysis to the prompt if available
  const requirementsAnalysis = state.analyzedRequirements;
  console.log("requirementsAnalysis", requirementsAnalysis);
  const requirementsContext = requirementsAnalysis
    ? `\nBased on the analyzed requirements:\n` +
    `Main Goal: ${requirementsAnalysis.mainGoal}\n` +
    `Key Features: ${requirementsAnalysis.keyFeatures.join(", ")}\n` +
    `Technical Requirements: ${requirementsAnalysis.technicalRequirements.join(", ")}\n` +
    `Design Preferences: ${requirementsAnalysis.preferences.join(", ")}\n` +
    `Considerations: ${requirementsAnalysis.considerations.join(", ")}\n` +
    `UI Components: ${requirementsAnalysis.uiComponents.join(", ")}\n` +
    `Interactions: ${requirementsAnalysis.interactions.join(", ")}\n` +
    `Data Visualization: ${requirementsAnalysis.dataVisualization.join(", ")}\n` +
    `Responsive Layouts: ${requirementsAnalysis.responsiveLayouts.join(", ")}\n` +
    `Accessibility Features: ${requirementsAnalysis.accessibilityFeatures.join(", ")}\n\n` +
    `Please generate HTML, CSS, and JavaScript code that implements these requirements, focusing on creating a beautiful and interactive user interface.`
    : "";

  const fullSystemPromptWithRequirements = fullSystemPrompt.replace("{requirementsAnalysis}", requirementsContext);

  const newArtifactResponse = await modelWithArtifactTool.invoke([
    {
      role: isO1MiniModel ? "user" : "system",
      content: fullSystemPromptWithRequirements,
    },
    ...contextDocumentMessages,
    ...state._messages,
  ]);
  console.log("artifactContentText", newArtifactResponse.content)
  const args = newArtifactResponse.tool_calls?.[0].args as
    | z.infer<typeof ARTIFACT_TOOL_SCHEMA>
    | undefined;
  if (!args) {
    throw new Error("No args found in response");
  }

  const newArtifactContent = createArtifactContent(args);
  const newArtifact: ArtifactV3 = {
    currentIndex: 1,
    contents: [newArtifactContent],
  };

  return {
    artifact: newArtifact,
  };
};
