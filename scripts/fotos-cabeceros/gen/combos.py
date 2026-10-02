# Las 16 combinaciones de tela + ribete (carpeta Drive "Shopify_Cabeceros" y pedidos 108-121 del CRM).
T="../telas/"
FORMAS=["Calobra","Pregonda","Macarella","Conta","Barbaria"]
C=[
 dict(id="01-ikat-verde-agua_ribete-mostaza", tela_img=T+"01.jpg", ancho_cm=75, modo="espejo",
      tela="Ikat Verde Agua: off-white cotton-linen ikat with sea-green (verde agua) flame-diamond motif",
      vivo="MATTE mustard (mostaza) cotton-linen fabric, a soft ochre, not shiny, not gold, not metallic, not plastic; exactly like the real piping in the last image", vivo_rgb=(214,172,98), vivo_ref=T+"01-ribete-mostaza-real.jpg", vivo_mate=True),
 dict(id="02-rayas-espiga-verde_ribete-granate", tela_img=T+"02-wb.jpg", ancho_cm=4.8, modo="raya",
      tela="Rayas Espiga Verde: light linen-look base with narrow grey-green herringbone (espiga) woven stripes, vertical",
      vivo="deep burgundy (granate) linen", vivo_rgb=(110,28,38)),
 dict(id="03-raya-arequipa-verde_ribete-verde", tela_img=T+"03-raya-arequipa.jpg", tile_src=("../imagenes/6.jpg",90,"verde_arequipa"), ancho_cm=11, modo="raya",
      tela="Raya Arequipa Verde: thick natural off-white cotton canvas with groups of bottle-green woven stripes (two textured bands and thin dashed lines), vertical",
      vivo="bottle green (verde botella) cotton", vivo_rgb=(58,118,88)),
 dict(id="04-baqueira_ribete-misma-tela", tela_img=T+"04.jpg", ancho_cm=8, modo="raya",
      tela="Baqueira: cream woven fabric with bold vertical stripes in black and blue-grey",
      vivo="the SAME Baqueira striped fabric (self piping). The piping and the side band must MATCH the front: along the top of the headboard each stripe of the front continues without a break onto the piping and over the side band, exactly as in the mock-up", vivo_rgb=None),
 dict(id="04-baqueira_ribete-negro", tela_img=T+"04.jpg", ancho_cm=8, modo="raya",
      tela="Baqueira: cream woven fabric with bold vertical stripes in black and blue-grey",
      vivo="solid black cotton, thin", vivo_rgb=(38,38,42), vivo_cm=0.55),
 dict(id="05-cerler_ribete-azul", tela_img=T+"05.jpg", ancho_cm=5, modo="raya",
      tela="Cerler: off-white woven fabric with pale blue double stripes, vertical",
      vivo="soft mid blue cotton", vivo_rgb=(80,120,165)),
 dict(id="05-cerler_ribete-misma-tela", tela_img=T+"05.jpg", ancho_cm=5, modo="raya",
      tela="Cerler: off-white woven fabric with pale blue double stripes, vertical",
      vivo="the SAME Cerler striped fabric (self piping). Along the top of the headboard the stripes of the front continue without a break onto the piping and over the side band, exactly as in the mock-up", vivo_rgb=None),
 dict(id="06-lino-palmeta-azul-marino_ribete-granate_lateral-azul-marino", tela_img=T+"06.jpg", ancho_cm=28, modo="periodo", vivo_cm=0.7,
      tela="Lino Palmeta Azul Marino: natural linen with navy blue ikat-style palmette motifs",
      vivo="deep burgundy (granate) linen", vivo_rgb=(110,28,38),
      lateral="plain navy blue linen (lino azul marino liso)", lateral_img=T+"liso-azul-marino.jpg", lateral_cm=10),
 dict(id="07-lino-rayas-verde-sage_ribete-verde_lateral-verde", tela_img=T+"07.jpg", ancho_cm=7.2, modo="raya",
      tela="Lino Rayas Verde Sage: cream linen with thin sage green pinstripe groups, vertical",
      vivo="sage green (verde) linen", vivo_rgb=(105,128,98),
      lateral="plain sage green linen (lino verde liso)", lateral_img=T+"liso-verde.jpg", lateral_cm=10),
 dict(id="08-lino-rayas-castilla_ribete-verde-grisaceo", tela_img=T+"08.jpg", ancho_cm=12, modo="raya",
      tela="Lino Rayas Castilla: natural beige linen with a grey-green stripe flanked by thin mustard lines, vertical",
      vivo="grey-green (verde grisaceo) linen", vivo_rgb=(122,138,122)),
 dict(id="09-recarano-azul_ribete-azul-en-tono", tela_img=T+"09-recarano-real-tile.png", tela_ref=T+"09-recarano-mini-ref.jpg", ancho_cm=5.3, modo="tile", lateral_img=T+"09-recarano-lateral.png", lateral_cm=5.3, lateral="the SAME Recarano light-blue chenille, but on the side band only its fine ribs show as thin lines (NO dotted rows on the side band)",
      tela="Recarano azul: soft light blue CHENILLE with fine VERTICAL ribs (about 4 mm pitch) separated by thin off-white lines, and HORIZONTAL off-white bands EXACTLY every 5 cm (exactly 20 evenly spaced dotted rows over the 100 cm height, perfectly straight and parallel, same on the side band), each carrying a row of small navy dots (one dot per rib). The ribs are FINE (about 5 mm, about 270 ribs across the 150 cm width), not wide stripes. The mock-up already carries a REAL photo of this fabric at true scale: keep its ribs, dotted rows and colours exactly. Image 2 is a real photo of this exact fabric on one of our small sample pieces",
      vivo="light blue matching the fabric (azul en tono)", vivo_rgb=(160,190,210)),
 dict(id="10-lola_ribete-azul-grisaceo-en-tono", tela_img=T+"10.jpg", ancho_cm=30, modo="espejo",
      tela="LOLA: soft LIGHT sky-blue-grey chenille and off-white woven geometric fabric (NOT dark grey): vertical stripes that step outwards forming nested diamond shapes, each diamond centred on a small navy square; same light blue tone as image 2",
      vivo="blue-grey matching the fabric (azul grisaceo en tono)", vivo_rgb=(95,120,140)),
 dict(id="11-lino-crema_lateral-flor-bosforo_ribete-granate", tela_img=T+"liso-crema.jpg", ancho_cm=30, modo="liso",
      tela="plain cream linen (lino crema liso), no pattern",
      vivo="deep burgundy (granate) linen", vivo_rgb=(110,28,38),
      lateral="Lino Flor Bosforo: natural linen printed with a Jacobean floral pattern in coral pink, sage and taupe, at a SMALL scale: each flower about 5 cm across, several flowers visible along the height of the side band", lateral_img=T+"11-flor-bosforo.jpg", lateral_cm=18),
 dict(id="12-silvestre-papiro_ribete-verde-agua", tela_img=T+"12-silvestre-papiro.jpg", ancho_cm=50, modo="tile",
      tela="Silvestre Papiro: beige-nude linen printed with watercolour thistles in pink and plum and sage-green leaves",
      vivo="soft verde agua (sea green) linen", vivo_rgb=(125,170,160)),
 dict(id="13-celtic-indigo-azul_ribete-azul-en-tono", tela_img=T+"13-celtic-muestra.jpg", tile_src=("../telas/13-celtic-muestra.jpg",90,"real"), ancho_cm=11, modo="raya",
      tela="Celtic indigo azul: off-white slubby cotton-linen with VERTICAL stripes in dusty indigo blue: a wide band flanked by thin lines, alternating with a group of fine dashed (broken) lines in slate and dark teal; repeat about 11 cm. Image 2 is a real photo of this fabric (shown with horizontal stripes; on the headboard they run vertically)",
      vivo="slate blue matching the fabric (azul en tono)", vivo_rgb=(80,100,135)),
 dict(id="14-anaya_ribete-azul-en-tono", tela_img=T+"14.jpg", ancho_cm=2.6, modo="raya",
      tela="Anaya: white ticking fabric with fine blue vertical pinstripes",
      vivo="mid blue matching the stripes (azul en tono)", vivo_rgb=(80,110,160)),
]

def tile_de(c):
    if "tile_src" not in c: return None
    import rayas
    p,rot,rc=c["tile_src"]
    if rc=="real":
        from PIL import Image
        import numpy as np
        t=rayas.tile_real(p,rot)[0]; a=np.asarray(t,float)
        base=np.percentile(a.reshape(-1,3),90,axis=0); a=a*np.array([238,234,224.])/base
        return Image.fromarray(np.clip(a,0,255).astype("uint8"))
    return rayas.tile_raya(p,rot,getattr(rayas,rc))[0]
