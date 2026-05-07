export type RiskLevel = "bajo" | "medio" | "alto" | "critico";

export type FraudSignal = {
  key: string;
  label: string;
  present: boolean;
  evidence?: string;
};

export type AnalysisResult = {
  score: number;
  nivel: RiskLevel;
  senales_detectadas: FraudSignal[];
  entidad_suplantada: string | null;
  explicacion: string;
  pasos: string[];
  fuentes_externas: {
    phishtank: boolean;
    cmf: boolean;
    urlhaus: boolean;
  };
  debug?: {
    modelRole?: string;
    model: string;
    usedClaude: boolean;
    urls: string[];
    embedding?: {
      provider: string;
      score: number;
      category: string | null;
      label: string | null;
      evidence: string | null;
      matches: string[];
    };
    agent?: {
      orchestrator: string;
      modelRole: string;
      execution: "parallel" | "sequential";
      selectedAgents: string[];
      skippedAgents: string[];
      decisions: Array<{
        agent: string;
        run: boolean;
        reason: string;
        tools: string[];
      }>;
      tools: Array<{
        agent: string;
        tool: string;
        status: "completed" | "skipped" | "failed";
        reason?: string;
        output?: string;
      }>;
      summary: string[];
    };
  };
};

export type InboxItem = {
  id: string;
  source: "email" | "sms" | "screenshot" | "manual";
  sender: string;
  subject?: string;
  preview: string;
  analysis: AnalysisResult;
};
