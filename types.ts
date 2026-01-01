
export interface PromptAnalysis {
  mainPrompt: string;
  subject: string;
  style: string;
  lighting: string;
  colors: string[];
  composition: string;
  technicalSpecs: string;
}

export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
  result: PromptAnalysis | null;
}
