import {
  getArtifactContent,
  isArtifactCodeContent,
} from "@opencanvas/shared/utils/artifacts";
import {
  ArtifactCodeV3,
  ArtifactMarkdownV3,
  ProgrammingLanguageOptions,
} from "@opencanvas/shared/types";
import {
  OPTIONALLY_UPDATE_META_PROMPT,
  UPDATE_ENTIRE_ARTIFACT_PROMPT,
} from "../../prompts";
import { OpenCanvasGraphAnnotation } from "../../state";
import { z } from "zod";
import { OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA, UI_EVALUATION_SCHEMA } from "./schemas";
import * as fs from 'fs';
import * as path from 'path';
import { ArticleEvaluation } from "./evaluation";

export const validateState = (
  state: typeof OpenCanvasGraphAnnotation.State
) => {
  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;
  if (!currentArtifactContent) {
    throw new Error("No artifact found");
  }

  const recentHumanMessage = state._messages.findLast(
    (message) => message.getType() === "human"
  );
  if (!recentHumanMessage) {
    throw new Error("No recent human message found");
  }

  return { currentArtifactContent, recentHumanMessage };
};

const buildMetaPrompt = (
  artifactMetaToolCall: z.infer<typeof OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA> | null
) => {
  const titleSection =
    artifactMetaToolCall?.title && artifactMetaToolCall?.type == "text"
      ? `And its title is (do NOT include this in your response):\n${artifactMetaToolCall.title}`
      : "";

  return OPTIONALLY_UPDATE_META_PROMPT.replace(
    "{artifactType}",
    artifactMetaToolCall?.type || "text"
  ).replace("{artifactTitle}", titleSection);
};

interface BuildPromptArgs {
  artifactContent: string;
  memoriesAsString: string;
  isNewType: boolean;
  artifactMetaToolCall: z.infer<typeof OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA> | null;
  webSearchResults: string;
  requirementsAnalysis: string;
  evaluationResults?: string;
  webDSL: string;
}

export const buildPrompt = ({
  artifactContent,
  memoriesAsString,
  isNewType,
  artifactMetaToolCall,
  webSearchResults,
  requirementsAnalysis,
  evaluationResults,
  webDSL
}: BuildPromptArgs) => {
  const metaPrompt = isNewType ? buildMetaPrompt(artifactMetaToolCall) : "";

  return UPDATE_ENTIRE_ARTIFACT_PROMPT.replace(
    "{artifactContent}",
    artifactContent
  )
    .replace("{reflections}", memoriesAsString)
    .replace("{updateMetaPrompt}", metaPrompt)
    .replace("{webSearchResults}", webSearchResults)
    .replace("{requirementsAnalysis}", requirementsAnalysis)
    .replace("{evaluationResults}", evaluationResults || "No previous evaluation results")
    .replace("{webDSL}", webDSL ? JSON.stringify(webDSL) : "No web DSL provided.")
    ;
};

interface CreateNewArtifactContentArgs {
  artifactType: string;
  state: typeof OpenCanvasGraphAnnotation.State;
  currentArtifactContent: ArtifactCodeV3 | ArtifactMarkdownV3;
  artifactMetaToolCall: z.infer<typeof OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA>;
  newContent: string;
}

const getLanguage = (
  artifactMetaToolCall: z.infer<typeof OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA>,
  currentArtifactContent: ArtifactCodeV3 | ArtifactMarkdownV3 // Replace 'any' with proper type
) =>
  artifactMetaToolCall?.language ||
  (isArtifactCodeContent(currentArtifactContent)
    ? currentArtifactContent.language
    : "other");

export const createNewArtifactContent = ({
  artifactType,
  state,
  currentArtifactContent,
  artifactMetaToolCall,
  newContent,
}: CreateNewArtifactContentArgs): ArtifactCodeV3 | ArtifactMarkdownV3 => {
  const baseContent = {
    index: state.artifact.contents.length + 1,
    title: artifactMetaToolCall?.title || currentArtifactContent.title,
  };

  if (artifactType === "code") {
    return {
      ...baseContent,
      type: "code",
      language: getLanguage(
        artifactMetaToolCall,
        currentArtifactContent
      ) as ProgrammingLanguageOptions,
      code: newContent,
    };
  }

  return {
    ...baseContent,
    type: "text",
    fullMarkdown: newContent,
  };
};


export interface Artifact {
  content: string;
  filename: string;
  rating?: z.infer<typeof UI_EVALUATION_SCHEMA> | any;
  userPrompt: any;
}

export interface ArtifactSet {
  artifacts: Artifact[];
  userPrompt: any;
  systemPrompt: string;
  originalArtifact: Artifact;
  iteration: number;
  evaluationResults?: ArticleEvaluation | null;
  webDSL: any;
}

export const saveArtifactsToFile = async (dirname: string, artifactSet: ArtifactSet) => {
  const baseDir = path.join(process.cwd(), 'temp_artifacts');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const artifactSetDir = path.join(baseDir, `${dirname}/iteration_${artifactSet.iteration}`);
  fs.mkdirSync(artifactSetDir, { recursive: true });

  for (const artifact of artifactSet.artifacts) {
    const artifactDir = path.join(artifactSetDir, path.parse(artifact.filename).name);
    fs.mkdirSync(artifactDir, { recursive: true });

    const filePath = path.join(artifactDir, artifact.filename);
    await fs.promises.writeFile(filePath, artifact.content);

    console.log(`Saved artifact ${artifact.filename} to ${filePath}`);

    if (artifact.rating) {
      const ratingContent = JSON.stringify(artifact.rating, null, 2);
      const ratingPath = path.join(artifactDir, 'rating.json');
      await fs.promises.writeFile(ratingPath, ratingContent);
    }
  }

  const originalArtifactPath = path.join(artifactSetDir, artifactSet.originalArtifact.filename);
  await fs.promises.writeFile(originalArtifactPath, artifactSet.originalArtifact.content);

  const promptPath = path.join(artifactSetDir, 'user_prompt.json');
  await fs.promises.writeFile(promptPath, JSON.stringify(artifactSet.userPrompt, null, 2));

  const systemPromptPath = path.join(artifactSetDir, 'system_prompt.txt');
  await fs.promises.writeFile(systemPromptPath, artifactSet.systemPrompt);

  if (artifactSet.evaluationResults) {
    const evaluationResultsPath = path.join(artifactSetDir, 'evaluation_results.json');
    await fs.promises.writeFile(evaluationResultsPath, JSON.stringify(artifactSet.evaluationResults, null, 2));
  }

  if (artifactSet.webDSL) {
    const webDSLPath = path.join(artifactSetDir, 'web_dsl.json');
    await fs.promises.writeFile(webDSLPath, JSON.stringify(artifactSet.webDSL, null, 2));
  }

  return artifactSetDir;
};


export const saveBestArtifactToFile = async (dirname: string, artifact: Artifact) => {
  const baseDir = path.join(process.cwd(), 'temp_artifacts');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const artifactSetDir = path.join(baseDir, `${dirname}`);
  fs.mkdirSync(artifactSetDir, { recursive: true });

  const filePath = path.join(artifactSetDir, artifact.filename);
  await fs.promises.writeFile(filePath, artifact.content);

  if (artifact.rating) {
    const ratingContent = JSON.stringify(artifact.rating, null, 2);
    const ratingPath = path.join(artifactSetDir, 'rating.json');
    await fs.promises.writeFile(ratingPath, ratingContent);
  }

  const userPromptPath = path.join(artifactSetDir, 'user_prompt.json');
  await fs.promises.writeFile(userPromptPath, JSON.stringify(artifact.userPrompt, null, 2));

  return filePath;
}