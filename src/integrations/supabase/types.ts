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
      catalogo_productos: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string
          id: string
          modelo: string
          orden: number
          precio_desde: number
          tipo: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string
          id?: string
          modelo: string
          orden?: number
          precio_desde?: number
          tipo: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string
          id?: string
          modelo?: string
          orden?: number
          precio_desde?: number
          tipo?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      lead_fotos: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          pie: string | null
          storage_path: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          pie?: string | null
          storage_path: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          pie?: string | null
          storage_path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_fotos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ciudad: string | null
          cliente_tipo: string
          cobrado: boolean
          created_at: string
          edad: string
          email: string | null
          etapa: string
          etiquetas: string[]
          fecha_cobro: string | null
          fecha_creacion: string
          fecha_entrada_etapa: string
          fecha_hold: string | null
          id: string
          nombre: string
          origen: string | null
          producto: string | null
          razon_urgencia: string | null
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
          cliente_tipo?: string
          cobrado?: boolean
          created_at?: string
          edad?: string
          email?: string | null
          etapa?: string
          etiquetas?: string[]
          fecha_cobro?: string | null
          fecha_creacion?: string
          fecha_entrada_etapa?: string
          fecha_hold?: string | null
          id?: string
          nombre: string
          origen?: string | null
          producto?: string | null
          razon_urgencia?: string | null
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
          cliente_tipo?: string
          cobrado?: boolean
          created_at?: string
          edad?: string
          email?: string | null
          etapa?: string
          etiquetas?: string[]
          fecha_cobro?: string | null
          fecha_creacion?: string
          fecha_entrada_etapa?: string
          fecha_hold?: string | null
          id?: string
          nombre?: string
          origen?: string | null
          producto?: string | null
          razon_urgencia?: string | null
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
      pedido_telas: {
        Row: {
          created_at: string
          estado: string
          fecha_recibo: string | null
          id: string
          nombre_tela: string | null
          orden: number
          pedido_id: string
          tipo_tela: string
        }
        Insert: {
          created_at?: string
          estado?: string
          fecha_recibo?: string | null
          id?: string
          nombre_tela?: string | null
          orden?: number
          pedido_id: string
          tipo_tela: string
        }
        Update: {
          created_at?: string
          estado?: string
          fecha_recibo?: string | null
          id?: string
          nombre_tela?: string | null
          orden?: number
          pedido_id?: string
          tipo_tela?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_telas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_nombre_libre: string | null
          coste_envio: number
          creado_manualmente: boolean
          created_at: string
          dias_plazo: number
          entregado: boolean
          entregado_fecha: string | null
          estado_pedido: string
          estructura_hecha: boolean
          estructura_hecha_fecha: string | null
          factura: string | null
          fecha_creacion_pedido: string
          fecha_entrega_real: string | null
          fecha_limite: string | null
          id: string
          lead_id: string | null
          notas_pedido: string | null
          pagado_50: boolean
          pagado_completo: boolean
          pago_todo_al_final: boolean
          precio: number
          precio_con_iva: number | null
          producto_lead_id: string | null
          reserva: number
          tapizado_hecho: boolean
          tapizado_hecho_fecha: string | null
          tela_pedida: boolean
          tela_pedida_fecha: string | null
          tela_recibida: boolean
          tela_recibida_fecha: string | null
          updated_at: string
        }
        Insert: {
          cliente_nombre_libre?: string | null
          coste_envio?: number
          creado_manualmente?: boolean
          created_at?: string
          dias_plazo?: number
          entregado?: boolean
          entregado_fecha?: string | null
          estado_pedido?: string
          estructura_hecha?: boolean
          estructura_hecha_fecha?: string | null
          factura?: string | null
          fecha_creacion_pedido?: string
          fecha_entrega_real?: string | null
          fecha_limite?: string | null
          id?: string
          lead_id?: string | null
          notas_pedido?: string | null
          pagado_50?: boolean
          pagado_completo?: boolean
          pago_todo_al_final?: boolean
          precio?: number
          precio_con_iva?: number | null
          producto_lead_id?: string | null
          reserva?: number
          tapizado_hecho?: boolean
          tapizado_hecho_fecha?: string | null
          tela_pedida?: boolean
          tela_pedida_fecha?: string | null
          tela_recibida?: boolean
          tela_recibida_fecha?: string | null
          updated_at?: string
        }
        Update: {
          cliente_nombre_libre?: string | null
          coste_envio?: number
          creado_manualmente?: boolean
          created_at?: string
          dias_plazo?: number
          entregado?: boolean
          entregado_fecha?: string | null
          estado_pedido?: string
          estructura_hecha?: boolean
          estructura_hecha_fecha?: string | null
          factura?: string | null
          fecha_creacion_pedido?: string
          fecha_entrega_real?: string | null
          fecha_limite?: string | null
          id?: string
          lead_id?: string | null
          notas_pedido?: string | null
          pagado_50?: boolean
          pagado_completo?: boolean
          pago_todo_al_final?: boolean
          precio?: number
          precio_con_iva?: number | null
          producto_lead_id?: string | null
          reserva?: number
          tapizado_hecho?: boolean
          tapizado_hecho_fecha?: string | null
          tela_pedida?: boolean
          tela_pedida_fecha?: string | null
          tela_recibida?: boolean
          tela_recibida_fecha?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_producto_lead_id_fkey"
            columns: ["producto_lead_id"]
            isOneToOne: false
            referencedRelation: "productos_lead"
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
          caracteristicas_confirmadas: boolean
          coleccion_tela: string | null
          color: string | null
          created_at: string
          created_by: string | null
          fecha_confirmacion: string | null
          id: string
          lead_id: string | null
          modelo: string | null
          notas_producto: string | null
          pagado_50: boolean
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
          caracteristicas_confirmadas?: boolean
          coleccion_tela?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          fecha_confirmacion?: string | null
          id?: string
          lead_id?: string | null
          modelo?: string | null
          notas_producto?: string | null
          pagado_50?: boolean
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
          caracteristicas_confirmadas?: boolean
          coleccion_tela?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          fecha_confirmacion?: string | null
          id?: string
          lead_id?: string | null
          modelo?: string | null
          notas_producto?: string | null
          pagado_50?: boolean
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalc_lead_valor: { Args: { _lead_id: string }; Returns: undefined }
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
