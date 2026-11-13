# Assets and licences

Everything shipped in `apps/web/public` is either made for this project or CC0 (public domain dedication),
so it can be used on a public site and in a portfolio without attribution. Credit is given anyway.

## Poly Haven (CC0) · https://polyhaven.com

Models (`public/models`, converted to GLB with 1k WebP textures and meshopt compression; three were simplified to 40% of their triangles):
`modern_arm_chair_01`, `mid_century_lounge_chair`, `side_table_01`, `coffee_table_round_01`, `wooden_display_shelves_01`,
`drawer_cabinet`, `modern_wooden_cabinet`, `steel_frame_shelves_03`, `wicker_basket_02`, `potted_plant_01`, `potted_plant_02`,
`potted_plant_04`, `desk_lamp_arm_01`, `ceramic_vase_01`, `ceramic_vase_03`, `standing_picture_frame_01`,
`book_encyclopedia_set_01`, `throw_pillows_01`. Catalogue thumbnails in `public/thumbs` are Poly Haven's previews of the same models.

Materials (`public/textures`, 1k, colour + normal + roughness): `wood_floor`, `laminate_floor_02`, `herringbone_parquet`,
`oak_veneer_01`, `plywood`, `black_oak_veneer`, `cotton_jersey`, `wool_boucle`.

Lighting environment (`public/env/studio.hdr`): `photo_studio_loft_hall`, 1k.

## Made for this project
The room shell (walls, floor, windows, skirting), the platform beds, desk, desk chair, rugs and framed print are generated in
code (`components/scene/Room.tsx`, `Built.tsx`). The print's artwork is two plain shapes, not a reproduction of an existing work.

## Not shipped
- Depth Anything 3 (model code cloned by `setup.sh`; Base and Metric-Large weights are Apache 2.0) is downloaded at setup, not stored here.
- Test photos used during development came from another project's example folder and are not in this repository.
- The Redwood bedroom scan used as the first demo has been removed.

## Font
Bricolage Grotesque, SIL Open Font License, via Fontsource.
