import { WEB_DSL_PROMPT } from "../../prompts";

interface BuildPromptArgs {
    artifactContent: string;
    memoriesAsString: string;
    requirementsAnalysis: string;
}

export const buildPrompt = ({
    artifactContent,
    memoriesAsString,
    requirementsAnalysis,
}: BuildPromptArgs) => {
    return WEB_DSL_PROMPT.replace("{artifactContent}", artifactContent)
        .replace("{reflections}", memoriesAsString)
        .replace("{requirementsAnalysis}", requirementsAnalysis);
};