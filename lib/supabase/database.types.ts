export interface Database {
  public: {
    Tables: {
      reports: {
        Row: {
          id: string;
          created_at: string;
          figma_url: string | null;
          web_url: string;
          viewports: string[];
          status: "processing" | "completed" | "failed";
          overall_score: number | null;
          summary: ReportSummary | null;
          user_id: string | null;
          parent_report_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          figma_url?: string | null;
          web_url: string;
          viewports: string[];
          status?: "processing" | "completed" | "failed";
          overall_score?: number | null;
          summary?: ReportSummary | null;
          user_id?: string | null;
          parent_report_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
      };
      issues: {
        Row: {
          id: string;
          report_id: string;
          category: string;
          subcategory: string;
          severity: "critical" | "warning" | "info";
          title: string;
          description: string;
          expected_value: string | null;
          actual_value: string | null;
          element: string | null;
          suggestion: string | null;
          screenshot_key: string | null;
          metadata: Record<string, unknown> | null;
          resolved: boolean;
        };
        Insert: {
          id?: string;
          report_id: string;
          category: string;
          subcategory: string;
          severity: "critical" | "warning" | "info";
          title: string;
          description: string;
          expected_value?: string | null;
          actual_value?: string | null;
          element?: string | null;
          suggestion?: string | null;
          screenshot_key?: string | null;
          metadata?: Record<string, unknown> | null;
          resolved?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["issues"]["Insert"]>;
      };
      screenshots: {
        Row: {
          id: string;
          report_id: string;
          type: string;
          viewport: string;
          storage_path: string;
          width: number;
          height: number;
        };
        Insert: {
          id?: string;
          report_id: string;
          type: string;
          viewport: string;
          storage_path: string;
          width: number;
          height: number;
        };
        Update: Partial<Database["public"]["Tables"]["screenshots"]["Insert"]>;
      };
      report_modules: {
        Row: {
          id: string;
          report_id: string;
          module: string;
          status: "pending" | "running" | "completed" | "failed";
          score: number | null;
          started_at: string | null;
          completed_at: string | null;
          error: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          module: string;
          status?: "pending" | "running" | "completed" | "failed";
          score?: number | null;
          started_at?: string | null;
          completed_at?: string | null;
          error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["report_modules"]["Insert"]>;
      };
    };
  };
}

export interface ReportSummary {
  overall_score: number;
  summary: string;
  top_issues: {
    category: string;
    title: string;
    description: string;
    severity: string;
  }[];
  module_scores: Record<string, number>;
}
