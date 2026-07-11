-- Alta de 17 colaboraciones (influencers). Idempotente (NOT EXISTS por nombre+tipo).
-- El texto descriptivo va como nota; lo que encaja se guarda en campos del lead.

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Fuen Albaladejo', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', '', 0, '', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Fuen Albaladejo' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Loreto Gordo', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', 'Pantalla de lámpara', 0, '', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Loreto Gordo' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Marieta Paramo', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', 'Puf', 0, '', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Marieta Paramo' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Lucía Laza', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', 'Cabecero', 0, '', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Lucía Laza' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Marta Sánchez Gabalda', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', 'Pantalla de lámpara', 0, '', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Marta Sánchez Gabalda' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Magui Postigo', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', 'Puf', 0, '', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Magui Postigo' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Ana Brito', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', '', 0, '', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Ana Brito' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Mery Arias', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', '', 0, '', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Mery Arias' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Leti Domenech', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', '', 0, '', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Leti Domenech' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Teresa Navarro', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', '', 0, '', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Teresa Navarro' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Ana Bastos', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', '', 0, '', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Ana Bastos' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Chotin', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', '', 0, '@chotin', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Chotin' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Gio', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Negociando', '', 170000, '', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Gio' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Pichifit', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', '', 0, '@pichifit', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Pichifit' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Almudenarl', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', '', 50000, '@almudenarl', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Almudenarl' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Patrillizos', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Contactado', '', 0, '@patrillizos', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Patrillizos' AND tipo='INFLUENCER');

INSERT INTO public.leads (nombre, tipo, vendedor, etapa, producto, seguidores, usuario, red_principal)
SELECT 'Mbarbarie', 'INFLUENCER', 'sangradortorresjuan@gmail.com', 'Ganado', 'Banco', 0, '@mbarbarie', 'Instagram'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE nombre='Mbarbarie' AND tipo='INFLUENCER');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'A partir de septiembre/octubre, tras la boda, le escribimos. Ya se le ha dicho a través de Alex Gutiérrez; le volveremos a escribir nosotros directamente a partir de septiembre.', 'Juan' FROM public.leads l
WHERE l.nombre='Fuen Albaladejo' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='A partir de septiembre/octubre, tras la boda, le escribimos. Ya se le ha dicho a través de Alex Gutiérrez; le volveremos a escribir nosotros directamente a partir de septiembre.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'No se sabe cuándo. Pantalla de lámpara y hace post de sorteo con nosotros.', 'Juan' FROM public.leads l
WHERE l.nombre='Loreto Gordo' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='No se sabe cuándo. Pantalla de lámpara y hace post de sorteo con nosotros.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'En verano. Historias. Puf burdeos y beige.', 'Juan' FROM public.leads l
WHERE l.nombre='Marieta Paramo' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='En verano. Historias. Puf burdeos y beige.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'No se sabe cuándo. Hace un poco de todo (reel/historia). Cabecero Conta y ella compra cojines.', 'Juan' FROM public.leads l
WHERE l.nombre='Lucía Laza' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='No se sabe cuándo. Hace un poco de todo (reel/historia). Cabecero Conta y ella compra cojines.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'No se sabe cuándo. Lámpara. Post o historia.', 'Juan' FROM public.leads l
WHERE l.nombre='Marta Sánchez Gabalda' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='No se sabe cuándo. Lámpara. Post o historia.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'No se sabe cuándo. Post. Pufs o banco.', 'Juan' FROM public.leads l
WHERE l.nombre='Magui Postigo' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='No se sabe cuándo. Post. Pufs o banco.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'No se sabe cuándo. Mención en recomendaciones de la semana. Dice que no quiere ningún producto, pero podemos tener un detalle con ella.', 'Juan' FROM public.leads l
WHERE l.nombre='Ana Brito' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='No se sabe cuándo. Mención en recomendaciones de la semana. Dice que no quiere ningún producto, pero podemos tener un detalle con ella.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'Escrita.', 'Juan' FROM public.leads l
WHERE l.nombre='Mery Arias' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='Escrita.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'Por escribir, aunque un amigo de Rocío ya le ha comentado.', 'Juan' FROM public.leads l
WHERE l.nombre='Leti Domenech' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='Por escribir, aunque un amigo de Rocío ya le ha comentado.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'Por escribir. Madre de mi amigo Garci y de Pablo Garna. Ya he escrito a Garci.', 'Juan' FROM public.leads l
WHERE l.nombre='Teresa Navarro' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='Por escribir. Madre de mi amigo Garci y de Pablo Garna. Ya he escrito a Garci.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'Por escribir.', 'Juan' FROM public.leads l
WHERE l.nombre='Ana Bastos' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='Por escribir.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'Amigo de mi padre. Escrito pero no ha contestado.', 'Juan' FROM public.leads l
WHERE l.nombre='Chotin' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='Amigo de mi padre. Escrito pero no ha contestado.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'Novia del hermano de Ale García Calvo. Tiene ~170k seguidores. Dice que ok pero todavía no ha elegido nada. Le hemos escrito por WhatsApp pero no ha respondido.', 'Juan' FROM public.leads l
WHERE l.nombre='Gio' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='Novia del hermano de Ale García Calvo. Tiene ~170k seguidores. Dice que ok pero todavía no ha elegido nada. Le hemos escrito por WhatsApp pero no ha respondido.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'Escrito, no ha respondido.', 'Juan' FROM public.leads l
WHERE l.nombre='Pichifit' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='Escrito, no ha respondido.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'Amiga de Jose, tiene 50k seguidores. Su hermano Hilario fue novio de la hermana del de Taburete (Rocío Carreño). Por escribir.', 'Juan' FROM public.leads l
WHERE l.nombre='Almudenarl' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='Amiga de Jose, tiene 50k seguidores. Su hermano Hilario fue novio de la hermana del de Taburete (Rocío Carreño). Por escribir.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'Falta por escribir. Se acaba de mudar; creo que le haría ilusión.', 'Juan' FROM public.leads l
WHERE l.nombre='Patrillizos' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='Falta por escribir. Se acaba de mudar; creo que le haría ilusión.');

INSERT INTO public.notas (lead_id, contenido, usuario)
SELECT l.id, 'Banco ya encargado.', 'Juan' FROM public.leads l
WHERE l.nombre='Mbarbarie' AND l.tipo='INFLUENCER'
  AND NOT EXISTS (SELECT 1 FROM public.notas n WHERE n.lead_id=l.id AND n.contenido='Banco ya encargado.');
