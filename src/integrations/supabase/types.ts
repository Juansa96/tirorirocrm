export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          campo: string
          created_at: string
          id: string
          lead_id: string | null
          tabla: string
          usuario: string | null
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          campo: string
          created_at?: string
          id?: string
          lead_id?: string | null
          tabla: string
          usuario?: string | null
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          campo?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          tabla?: string
          usuario?: string | null
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          ciudad: string | null
          created_at: string
          edad: string | null
          email: string | null
          etapa: string
          fecha_creacion: string
          fecha_hold: string | null
          id: string
          nombre: string
          origen: string | null
          producto: string | null
          red_social: string | null
          telefono: string | null
          updated_at: string
          valor: number
          valor_envio: number
          valor_producto: number
          vendedor: string
        }
        Insert: {
          ciudad?: string | null
          created_at?: string
          edad?: string | null
          email?: string | null
          etapa?: string
          fecha_creacion?: string
          fecha_hold?: string | null
          id?: string
          nombre: string
          origen?: string | null
          producto?: string | null
          red_social?: string | null
          telefono?: string | null
          updated_at?: string
          valor?: number
          valor_envio?: number
          valor_producto?: number
          vendedor: string
        }
        Update: {
          ciudad?: string | null
          created_at?: string
          edad?: string | null
          email?: string | null
          etapa?: string
          fecha_creacion?: string
          fecha_hold?: string | null
          id?: string
          nombre?: string
          origen?: string | null
          producto?: string | null
          red_social?: string | null
          telefono?: string | null
          updated_at?: string
          valor?: number
          valor_envio?: number
          valor_producto?: number
          vendedor?: string
        }
        Relationships: []
      }
      notas: {
        Row: {
          contenido: string
          created_at: string
          id: string
          lead_id: string | null
          usuario: string | null
        }
        Insert: {
          contenido: string
          created_at?: string
          id?: string
          lead_id?: string | null
          usuario?: string | null
        }
        Update: {
          contenido?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      productos_lead: {
        Row: {
          acabado: string | null
          alto: number | null
          ancho: number | null
          cantidad: number
          coleccion_tela: string | null
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          modelo: string | null
          notas_producto: string | null
          patas: string | null
          precio_unitario: number
          relleno: string | null
          tela: string | null
          tipo: string | null
        }
        Insert: {
          acabado?: string | null
          alto?: number | null
          ancho?: number | null
          cantidad?: number
          coleccion_tela?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          modelo?: string | null
          notas_producto?: string | null
          patas?: string | null
          precio_unitario?: number
          relleno?: string | null
          tela?: string | null
          tipo?: string | null
        }
        Update: {
          acabado?: string | null
          alto?: number | null
          ancho?: number | null
          cantidad?: number
          coleccion_tela?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          modelo?: string | null
          notas_producto?: string | null
          patas?: string | null
          precio_unitario?: number
          relleno?: string | null
          tela?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_lead_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      tareas: {
        Row: {
          completada: boolean
          created_at: string
          descripcion: string
          fecha: string
          hora: string | null
          id: string
          lead_id: string
          vendedor: string
        }
        Insert: {
          completada?: boolean
          created_at?: string
          descripcion: string
          fecha: string
          hora?: string | null
          id?: string
          lead_id: string
          vendedor: string
        }
        Update: {
          completada?: boolean
          created_at?: string
          descripcion?: string
          fecha?: string
          hora?: string | null
          id?: string
          lead_id?: string
          vendedor?: string
        }
        Relationships: [
          {
            foreignKeyName: "tareas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
