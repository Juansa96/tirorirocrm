-- Plazo de entrega por defecto: 30 días (un mes) en vez de 20.
-- El CRM siempre envía dias_plazo al crear el pedido, así que este cambio solo
-- afecta a inserciones que no lo indiquen (p. ej. a mano en la base de datos).
ALTER TABLE public.pedidos ALTER COLUMN dias_plazo SET DEFAULT 30;
