// draco3dgltf ships no types; gltf-transform only needs the decoder module handed to it.
declare module 'draco3dgltf' {
  const draco3d: { createDecoderModule(): Promise<unknown> }
  export default draco3d
}
