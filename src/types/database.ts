export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: 'admin' | 'manager' | 'operator' | 'pending';
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: 'admin' | 'manager' | 'operator' | 'pending';
        };
        Update: {
          full_name?: string | null;
          role?: 'admin' | 'manager' | 'operator' | 'pending';
        };
        Relationships: [];
      };
      user_push_tokens: {
        Row: {
          user_id: string;
          push_token: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          push_token: string;
          updated_at?: string;
        };
        Update: {
          push_token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      operators: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          role: string;
          created_by: string;
          auth_user_id: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          name: string;
          email?: string | null;
          phone?: string | null;
          role: string;
          created_by: string;
          auth_user_id?: string | null;
          active?: boolean;
        };
        Update: {
          name?: string;
          email?: string | null;
          phone?: string | null;
          role?: string;
          auth_user_id?: string | null;
          active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'operators_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      equipment_types: {
        Row: {
          id: string;
          name: string;
          category: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          name: string;
          category: string;
          active?: boolean;
        };
        Update: {
          name?: string;
          category?: string;
          active?: boolean;
        };
        Relationships: [];
      };
      checklist_template_items: {
        Row: {
          id: string;
          equipment_type_id: string;
          description: string;
          is_blocking: boolean;
          section: string | null;
          order_index: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          equipment_type_id: string;
          description: string;
          is_blocking?: boolean;
          section?: string | null;
          order_index?: number;
          active?: boolean;
        };
        Update: {
          description?: string;
          is_blocking?: boolean;
          section?: string | null;
          order_index?: number;
          active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'checklist_template_items_equipment_type_id_fkey';
            columns: ['equipment_type_id'];
            isOneToOne: false;
            referencedRelation: 'equipment_types';
            referencedColumns: ['id'];
          },
        ];
      };
      pre_operation_checks: {
        Row: {
          id: string;
          operator_id: string;
          date: string;
          checklist_fisico: boolean;
          prontos_preenchido: boolean;
          apto_operar: boolean;
          conhece_limites: boolean;
          art_disponivel: boolean;
          liberacao_acesso: boolean | null;
          pts_preenchida: boolean | null;
          local_adequado: boolean;
          local_sinalizado: boolean;
          manutencao_valida: boolean;
          radio_comunicacao: boolean;
          epi_adequado: boolean;
          created_at: string;
        };
        Insert: {
          operator_id: string;
          date?: string;
          checklist_fisico?: boolean;
          prontos_preenchido?: boolean;
          apto_operar?: boolean;
          conhece_limites?: boolean;
          art_disponivel?: boolean;
          liberacao_acesso?: boolean | null;
          pts_preenchida?: boolean | null;
          local_adequado?: boolean;
          local_sinalizado?: boolean;
          manutencao_valida?: boolean;
          radio_comunicacao?: boolean;
          epi_adequado?: boolean;
        };
        Update: {
          checklist_fisico?: boolean;
          prontos_preenchido?: boolean;
          apto_operar?: boolean;
          conhece_limites?: boolean;
          art_disponivel?: boolean;
          liberacao_acesso?: boolean | null;
          pts_preenchida?: boolean | null;
          local_adequado?: boolean;
          local_sinalizado?: boolean;
          manutencao_valida?: boolean;
          radio_comunicacao?: boolean;
          epi_adequado?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'pre_operation_checks_operator_id_fkey';
            columns: ['operator_id'];
            isOneToOne: false;
            referencedRelation: 'operators';
            referencedColumns: ['id'];
          },
        ];
      };
      machines: {
        Row: {
          id: string;
          name: string;
          tag: string | null;
          max_load_capacity: string | null;
          serial_number: string | null;
          notes: string | null;
          qr_code: string | null;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          tag?: string | null;
          max_load_capacity?: string | null;
          serial_number?: string | null;
          notes?: string | null;
          qr_code?: string | null;
          active?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          tag?: string | null;
          max_load_capacity?: string | null;
          serial_number?: string | null;
          notes?: string | null;
          active?: boolean;
        };
        Relationships: [];
      };
      machine_checklist_items: {
        Row: {
          id: string;
          machine_id: string;
          order_index: number;
          section: string | null;
          description: string;
          is_blocking: boolean;
          response_type: 'yes_no' | 'yes_no_na' | 'text' | 'photo' | 'numeric';
          active: boolean;
          created_at: string;
        };
        Insert: {
          machine_id: string;
          order_index?: number;
          section?: string | null;
          description: string;
          is_blocking?: boolean;
          response_type?: 'yes_no' | 'yes_no_na' | 'text' | 'photo' | 'numeric';
          active?: boolean;
        };
        Update: {
          order_index?: number;
          section?: string | null;
          description?: string;
          is_blocking?: boolean;
          response_type?: 'yes_no' | 'yes_no_na' | 'text' | 'photo' | 'numeric';
          active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'machine_checklist_items_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines';
            referencedColumns: ['id'];
          },
        ];
      };
      checklists: {
        Row: {
          id: string;
          operator_id: string;
          equipment_type_id: string | null;
          machine_id: string | null;
          pre_operation_id: string | null;
          machine_name: string;
          brand: string | null;
          model: string | null;
          tag: string | null;
          shift: string | null;
          max_load_capacity: string | null;
          date: string;
          status: 'pending' | 'completed';
          result: 'released' | 'not_released' | null;
          inspector_name: string | null;
          inspector_registration: string | null;
          notes: string | null;
          equipment_photo_1_url: string | null;
          equipment_photo_2_url: string | null;
          equipment_photo_3_url: string | null;
          equipment_photo_4_url: string | null;
          environment_photo_url: string | null;
          ended_at: string | null;
          end_photo_url: string | null;
          had_interference: boolean;
          interference_notes: string | null;
          transit_start: string | null;
          transit_end: string | null;
          end_notes: string | null;
          created_at: string;
        };
        Insert: {
          operator_id: string;
          equipment_type_id?: string | null;
          machine_id?: string | null;
          pre_operation_id?: string | null;
          machine_name: string;
          brand?: string | null;
          model?: string | null;
          tag?: string | null;
          shift?: string | null;
          max_load_capacity?: string | null;
          date: string;
          status?: 'pending' | 'completed';
          result?: 'released' | 'not_released' | null;
          inspector_name?: string | null;
          inspector_registration?: string | null;
          notes?: string | null;
          equipment_photo_1_url?: string | null;
          equipment_photo_2_url?: string | null;
          equipment_photo_3_url?: string | null;
          equipment_photo_4_url?: string | null;
          environment_photo_url?: string | null;
        };
        Update: {
          status?: 'pending' | 'completed';
          result?: 'released' | 'not_released' | null;
          inspector_name?: string | null;
          inspector_registration?: string | null;
          notes?: string | null;
          equipment_photo_1_url?: string | null;
          equipment_photo_2_url?: string | null;
          equipment_photo_3_url?: string | null;
          equipment_photo_4_url?: string | null;
          environment_photo_url?: string | null;
          ended_at?: string | null;
          end_photo_url?: string | null;
          had_interference?: boolean;
          interference_notes?: string | null;
          transit_start?: string | null;
          transit_end?: string | null;
          end_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'checklists_operator_id_fkey';
            columns: ['operator_id'];
            isOneToOne: false;
            referencedRelation: 'operators';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checklists_equipment_type_id_fkey';
            columns: ['equipment_type_id'];
            isOneToOne: false;
            referencedRelation: 'equipment_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checklists_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines';
            referencedColumns: ['id'];
          },
        ];
      };
      checklist_items: {
        Row: {
          id: string;
          checklist_id: string;
          description: string;
          checked: boolean;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          checklist_id: string;
          description: string;
          checked?: boolean;
          photo_url?: string | null;
        };
        Update: {
          checked?: boolean;
          photo_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'checklist_items_checklist_id_fkey';
            columns: ['checklist_id'];
            isOneToOne: false;
            referencedRelation: 'checklists';
            referencedColumns: ['id'];
          },
        ];
      };
      checklist_responses: {
        Row: {
          id: string;
          checklist_id: string;
          template_item_id: string | null;
          machine_item_id: string | null;
          status: 'C' | 'NC' | 'NA';
          response_value: string | null;
          photo_url: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          checklist_id: string;
          template_item_id?: string | null;
          machine_item_id?: string | null;
          status: 'C' | 'NC' | 'NA';
          response_value?: string | null;
          photo_url?: string | null;
          notes?: string | null;
        };
        Update: {
          status?: 'C' | 'NC' | 'NA';
          response_value?: string | null;
          photo_url?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'checklist_responses_checklist_id_fkey';
            columns: ['checklist_id'];
            isOneToOne: false;
            referencedRelation: 'checklists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checklist_responses_template_item_id_fkey';
            columns: ['template_item_id'];
            isOneToOne: false;
            referencedRelation: 'checklist_template_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checklist_responses_machine_item_id_fkey';
            columns: ['machine_item_id'];
            isOneToOne: false;
            referencedRelation: 'machine_checklist_items';
            referencedColumns: ['id'];
          },
        ];
      };
      activities: {
        Row: {
          id: string;
          operator_id: string;
          checklist_id: string | null;
          pre_operation_id: string | null;
          date: string;
          equipment_tag: string | null;
          location: string | null;
          description: string | null;
          start_time: string | null;
          end_time: string | null;
          equipment_photo_url: string | null;
          start_photo_url: string | null;
          end_photo_url: string | null;
          had_interference: boolean;
          interference_notes: string | null;
          transit_start: string | null;
          transit_end: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          operator_id: string;
          checklist_id?: string | null;
          pre_operation_id?: string | null;
          date?: string;
          equipment_tag?: string | null;
          location?: string | null;
          description?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          equipment_photo_url?: string | null;
          start_photo_url?: string | null;
          end_photo_url?: string | null;
          had_interference?: boolean;
          interference_notes?: string | null;
          transit_start?: string | null;
          transit_end?: string | null;
          notes?: string | null;
        };
        Update: {
          equipment_photo_url?: string | null;
          start_photo_url?: string | null;
          end_time?: string | null;
          end_photo_url?: string | null;
          had_interference?: boolean;
          interference_notes?: string | null;
          transit_start?: string | null;
          transit_end?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'activities_operator_id_fkey';
            columns: ['operator_id'];
            isOneToOne: false;
            referencedRelation: 'operators';
            referencedColumns: ['id'];
          },
        ];
      };
      safety_alerts: {
        Row: {
          id: string;
          title: string;
          message: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          operator_id: string | null;
          created_by: string;
          read: boolean;
          response: string | null;
          responded_at: string | null;
          created_at: string;
        };
        Insert: {
          title: string;
          message: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          operator_id?: string | null;
          created_by: string;
          read?: boolean;
          response?: string | null;
          responded_at?: string | null;
        };
        Update: {
          title?: string;
          message?: string;
          severity?: 'low' | 'medium' | 'high' | 'critical';
          read?: boolean;
          response?: string | null;
          responded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'safety_alerts_operator_id_fkey';
            columns: ['operator_id'];
            isOneToOne: false;
            referencedRelation: 'operators';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'safety_alerts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      behavioral_inspections: {
        Row: {
          id: string;
          observer_id: string;
          operator_id: string;
          date: string;
          time: string | null;
          unit_contract: string | null;
          area: string | null;
          equipment: string | null;
          activity_type: string | null;
          observation_type: 'routine' | 'critical_activity' | 'post_incident' | 'deviation_followup' | 'scheduled_audit';
          overall_classification: 'safe' | 'attention' | 'critical' | null;
          safe_behavior_description: string | null;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          observer_id: string;
          operator_id: string;
          date?: string;
          time?: string | null;
          unit_contract?: string | null;
          area?: string | null;
          equipment?: string | null;
          activity_type?: string | null;
          observation_type: 'routine' | 'critical_activity' | 'post_incident' | 'deviation_followup' | 'scheduled_audit';
          overall_classification?: 'safe' | 'attention' | 'critical' | null;
          safe_behavior_description?: string | null;
          photo_url?: string | null;
        };
        Update: {
          overall_classification?: 'safe' | 'attention' | 'critical' | null;
          safe_behavior_description?: string | null;
          photo_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'behavioral_inspections_observer_id_fkey';
            columns: ['observer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'behavioral_inspections_operator_id_fkey';
            columns: ['operator_id'];
            isOneToOne: false;
            referencedRelation: 'operators';
            referencedColumns: ['id'];
          },
        ];
      };
      behavioral_inspection_items: {
        Row: {
          id: string;
          inspection_id: string;
          category: 'risk_perception' | 'attitude' | 'ppe' | 'operation' | 'communication' | 'environment';
          description: string;
          status: 'sim' | 'nao' | 'na';
          created_at: string;
        };
        Insert: {
          inspection_id: string;
          category: 'risk_perception' | 'attitude' | 'ppe' | 'operation' | 'communication' | 'environment';
          description: string;
          status: 'sim' | 'nao' | 'na';
        };
        Update: {
          status?: 'sim' | 'nao' | 'na';
        };
        Relationships: [
          {
            foreignKeyName: 'behavioral_inspection_items_inspection_id_fkey';
            columns: ['inspection_id'];
            isOneToOne: false;
            referencedRelation: 'behavioral_inspections';
            referencedColumns: ['id'];
          },
        ];
      };
      behavioral_deviations: {
        Row: {
          id: string;
          inspection_id: string;
          description: string;
          risk_level: 'low' | 'medium' | 'high' | 'critical';
          immediate_action: 'verbal_guidance' | 'activity_intervention' | 'activity_stoppage' | 'immediate_correction' | null;
          immediate_action_description: string | null;
          corrective_action: string | null;
          responsible: string | null;
          deadline: string | null;
          status: 'open' | 'in_progress' | 'completed';
          created_at: string;
        };
        Insert: {
          inspection_id: string;
          description: string;
          risk_level: 'low' | 'medium' | 'high' | 'critical';
          immediate_action?: 'verbal_guidance' | 'activity_intervention' | 'activity_stoppage' | 'immediate_correction' | null;
          immediate_action_description?: string | null;
          corrective_action?: string | null;
          responsible?: string | null;
          deadline?: string | null;
          status?: 'open' | 'in_progress' | 'completed';
        };
        Update: {
          immediate_action_description?: string | null;
          corrective_action?: string | null;
          responsible?: string | null;
          deadline?: string | null;
          status?: 'open' | 'in_progress' | 'completed';
        };
        Relationships: [
          {
            foreignKeyName: 'behavioral_deviations_inspection_id_fkey';
            columns: ['inspection_id'];
            isOneToOne: false;
            referencedRelation: 'behavioral_inspections';
            referencedColumns: ['id'];
          },
        ];
      };
      operator_scores: {
        Row: {
          id: string;
          operator_id: string;
          period: string;
          checklists_total: number;
          checklists_done: number;
          inspections_total: number;
          inspections_done: number;
          deviations_count: number;
          critical_deviations: number;
          productivity_index: number;
          avg_operation_minutes: number;
          interventions_count: number;
          score: number;
          calculated_at: string;
        };
        Insert: {
          operator_id: string;
          period: string;
          checklists_total?: number;
          checklists_done?: number;
          inspections_total?: number;
          inspections_done?: number;
          deviations_count?: number;
          critical_deviations?: number;
          productivity_index?: number;
          avg_operation_minutes?: number;
          interventions_count?: number;
          score?: number;
        };
        Update: {
          checklists_total?: number;
          checklists_done?: number;
          inspections_total?: number;
          inspections_done?: number;
          deviations_count?: number;
          critical_deviations?: number;
          productivity_index?: number;
          avg_operation_minutes?: number;
          interventions_count?: number;
          score?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'operator_scores_operator_id_fkey';
            columns: ['operator_id'];
            isOneToOne: false;
            referencedRelation: 'operators';
            referencedColumns: ['id'];
          },
        ];
      };
      review_comments: {
        Row: {
          id: string;
          entity_type: 'checklist' | 'activity';
          entity_id: string;
          author_id: string;
          author_name: string | null;
          content: string;
          created_at: string;
        };
        Insert: {
          entity_type: 'checklist' | 'activity';
          entity_id: string;
          author_id: string;
          author_name?: string | null;
          content: string;
        };
        Update: {
          content?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Operator = Database['public']['Tables']['operators']['Row'];
export type EquipmentType = Database['public']['Tables']['equipment_types']['Row'];
export type ChecklistTemplateItem = Database['public']['Tables']['checklist_template_items']['Row'];
export type Machine = Database['public']['Tables']['machines']['Row'];
export type MachineChecklistItem = Database['public']['Tables']['machine_checklist_items']['Row'];
export type PreOperationCheck = Database['public']['Tables']['pre_operation_checks']['Row'];
export type Checklist = Database['public']['Tables']['checklists']['Row'];
export type ChecklistItem = Database['public']['Tables']['checklist_items']['Row'];
export type ChecklistResponse = Database['public']['Tables']['checklist_responses']['Row'];
export type Activity = Database['public']['Tables']['activities']['Row'];
export type SafetyAlert = Database['public']['Tables']['safety_alerts']['Row'];
export type BehavioralInspection = Database['public']['Tables']['behavioral_inspections']['Row'];
export type BehavioralInspectionItem = Database['public']['Tables']['behavioral_inspection_items']['Row'];
export type BehavioralDeviation = Database['public']['Tables']['behavioral_deviations']['Row'];
export type OperatorScore = Database['public']['Tables']['operator_scores']['Row'];
export type ReviewComment = Database['public']['Tables']['review_comments']['Row'];
