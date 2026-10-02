# Fotos de cabeceros con IA — cómo las quiere Juan

Todo lo que Juan ha pedido, corregido y aprobado en el chat (septiembre–octubre 2026).
Se lee ANTES de cada tanda y se repasa la lista del final ANTES de enseñarle nada.

## 1. Forma de trabajar

- **Nunca hacerlo todo de golpe.** Una tanda = una tela con un ribete en sus 5 formas
  (Calobra, Pregonda, Macarella, Conta, Barbaria). Se le enseña, la valida y solo entonces
  se pasa a la siguiente. "Enseña y te voy corrigiendo."
- **Consultar las cosas dudosas antes** de gastar tiempo o créditos.
- **Enseñar siempre las fotos** (no solo describirlas) y, además, hojas de detalle de cerca:
  esquinas, remate de abajo y ribete de cerca.
- Si corrige una sola foto: **arreglar solo esa y pasarle solo esa.**
- "Aprobado en el límite" significa aprobado, pero hay que mirar con más lupa en las siguientes.
- **Gastar lo mínimo en Gemini.** Gemini solo hace la forma, la luz y la escena. Todo lo que
  se pueda arreglar sin Gemini se arregla sin Gemini. Avisar en cuanto se acaben los créditos
  (error 402) y decir cuánto se ha gastado en cada tanda.
- La tela se llama **Recarano** (no "Recatando").
- Hablarle claro y corto, sin tecnicismos.

## 2. Escena

- La primera foto de cada producto: cabecero **apoyado en la pared, sobre el suelo**, estilo
  estudio, visto **de lado (3/4 desde la izquierda)**, para que se vean el frente, el lateral
  y el ribete.
- **Pared y suelo idénticos en las 80 fotos** (fondo fijo `fondo4k-cc.png`).
- Luz de ventana, pero **la ventana no sale nunca**.
- Cámara cerca, **poca pared por encima**.
- Muy realista y minimalista. **4K, sin pixelado.**

## 3. Forma del cabecero

- **75 % recto y 25 % curvo.** Las formas salen de sus croquis.
- Barbaria: **5 olas suaves y redondas, sin picos.**
- **Ninguna esquina viva:** todo un poco redondeado. Las esquinas de abajo son cuadradas,
  porque los lados bajan rectos al suelo.
- El borde del cabecero se ve siempre. **Nada transparente**: no se puede ver el suelo a
  través del borde ni de la base.

## 4. Tela del frente

- **Fiel a la tela real**, sacada de la foto real (minis y fotos de Drive). Si una tela no
  está clara, pedirle una foto.
- Rayas: **rectas, equidistantes, sin pixelar**, a escala real. En 150 cm cabe un número
  entero de repeticiones, con el hueco blanco centrado en los dos bordes.
- **Fondo de la tela uniforme**, sin "parches" más claros u oscuros (pasó con Cerler).
- La escala la decide él (por ejemplo, el dibujo de LOLA un 15 % más grande y Flor Bósforo un
  poco más pequeño).

## 5. Lateral (el canto, el grosor)

- Rayas **seguidas, sin huecos blancos ni saltos**. En el lado izquierdo van horizontales.
- **Arriba, la raya del frente sigue igual por el lateral**, también en las curvas, olas y
  hombros.
- El cambio de "sigue al frente" a "bajo en horizontal" se hace **siempre en un hueco blanco
  entre rayas, nunca encima de una raya** (si no, salen rayitas raras o una raya del frente
  no casa; pasó dos veces en la Pregonda).
- Las rayas del lateral y del ribete tienen **el mismo ancho que las del frente**: no se
  ensanchan aunque la curva suba (en el cruce de cada raya, la tela avanza a su ritmo real
  y casa en el centro del cruce).
- El lado derecho no se ve: ahí da igual.

## 6. Ribete (lo que más corrige)

### Aspecto
- **Real, de tela, mate.** Nada de "render 3D", brillo de plástico, contorno negro ni
  "dibujos animados".
- **Cilíndrico, no plano:** más claro en el centro y más oscuro hacia los bordes.
- **Mismo grosor en todo el recorrido**, a izquierda y derecha. El de la derecha no puede
  salir más gordo, ni hacer cambios bruscos de grosor.
- Colores fieles: no oscurecerlos de más (pasó con el mostaza, el Arequipa y el Recarano).

### Recorrido y remate
- **Nunca va por la base.** Baja recto por los dos lados.
- **Llega hasta abajo del todo** y en el último tramo **se mete un poco en la costura**:
  - de forma suave y continua, sin cortarse de golpe;
  - pegado al borde: no se va hacia dentro del frente ni "vuela";
  - lo justo para que apenas se note.
- **Un solo ribete por lado.** Si Gemini pinta el suyo a la derecha, se quita, se pone pared
  limpia y se dibuja el nuestro en el borde real.
- En el remate de abajo **no puede caer ninguna rayita** ("el cuadrado").

### Ribete de la misma tela
- Sus rayas **casan con el lateral izquierdo y con el de arriba**, y con el frente.
- Las **dos rayas de cada par con el mismo grosor** (una salía más fina).
- A la derecha no tiene que casar con el lateral, pero las rayitas tienen que estar bien
  hechas: un solo ribete, sin rayas dobladas.

## 7. Qué funciona y qué no (técnico)

| Funciona | No funciona |
|---|---|
| Maqueta 3D exacta, más el render 4K de Gemini, más la tela exacta puesta encima con la luz de Gemini | Dejar que Gemini pinte la tela, el lateral o el ribete (se inventa rayas, grosores, brillos) |
| Ribete dibujado por nosotros (cilindro mate, grosor por perspectiva, remate determinista) | Retoques de esquina con Gemini (salen distintos en cada foto: curvas por la base, manchas, cortes) |
| Fondo fijo restaurado fuera de la pieza | Limpiar a mano el ribete de la base (deja suelo o zonas transparentes) |
| Control de forma (parecido > 0,95) y repetición automática si sale mal | Aceptar renders con forma o ángulo distintos |
| Revisar hojas de detalle de cerca antes de enviar | Enviar sin mirar de cerca |

## 8. Lista antes de enseñar una tanda

1. ¿Forma y ángulo correctos? ¿Barbaria sin picos? ¿Esquinas redondeadas?
2. ¿Pared, suelo y encuadre iguales que en las aprobadas? ¿Sin ventana?
3. ¿Tela nítida, rayas rectas y equidistantes, fondo sin parches?
4. ¿Lateral sin huecos, con las rayas casando arriba (también en los hombros) y del mismo ancho que las del frente?
5. ¿Alguna raya del frente que no case con el ribete o el lateral? (comprobación automática)
6. ¿Ribete redondo, mate, sin contorno, con grosor constante en los dos lados?
7. ¿El ribete llega al suelo y se mete suave, pegado al borde, a los dos lados?
8. ¿Un solo ribete a la derecha? ¿Sin rayitas en el remate?
9. ¿Ninguna zona transparente ni manchas en la base?
10. Hojas de cerca preparadas: detalles, remate de abajo y ribete de cerca.

## 9. Estado

Aprobadas: 01 Ikat (en el límite), 02 Rayas Espiga, 03 Raya Arequipa, 04 Baqueira con ribete
de la misma tela, 04 Baqueira con ribete negro, 05 Cerler con ribete azul (en el límite).
Pendiente de validar: 05 Cerler con ribete de la misma tela (Pregonda corregida).
Siguientes: 06 Lino palmeta, 07 Verde Sage, 08 Castilla, 09 Recarano, 10 LOLA,
11 Lino crema / Flor Bósforo, 12 Silvestre, 13 Celtic, 14 Anaya.

## 10. Cómo se usa el programa

Carpeta `gen/` (Python 3 con Pillow y numpy; sin más dependencias). Telas en `telas/` y en
`imagenes/`, fondo fijo en `gen/fondo.png` y `gen/fondo4k-cc.jpg`. Se ejecuta desde `gen/`.

- Gemini por HTTP directo (`gemini.py`, modelo `gemini-3.1-flash-image`). En el entorno de
  Claude la clave la pone el proxy; fuera de él hay que añadir la cabecera `x-goog-api-key`.
- Combinaciones de tela y ribete: `combos.py`.
- Una tanda (5 formas de una combinación): `python3 tanda.py <prefijo del id> <carpeta>`.
  Genera los renders 4K (y los reutiliza si ya existen y la forma está bien), pone tela,
  lateral y ribete exactos y exporta `envio/`.
- Rehacer sin gastar Gemini: `v6.hacer(c, forma, salida, intentos=0, reusar=True)`.
- Antes de enseñar: `python3 revisar.py <carpeta> <id>` (hojas de cerca y comprobación de
  rayas).
- Piezas: `siluetas.py` (formas), `escena.py` (maqueta 3D, cámara y mapeo de la tela en el
  canto), `textura.py` y `rayas.py` (tela a escala), `foto.py` (prompt, fondo fijo y paso
  de la tela exacta), `vivo_det.py` y `vivo_misma.py` (ribete), `suelo.py` (limpieza de la
  base), `qa.py` (parecido con la maqueta).
