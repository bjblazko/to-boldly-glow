// U (longitude) wraps around the sphere's seam; V (latitude) must not wrap over the poles.
// Anisotropic filtering sharpens grazing views (ring edges, limbs); WebGPU exposes no queryable
// maximum, and 16 is the conventional ceiling implementations clamp to.
export function createBodySampler(device: GPUDevice): GPUSampler {
  return device.createSampler({
    label: 'body texture sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    maxAnisotropy: 16,
    addressModeU: 'repeat',
    addressModeV: 'clamp-to-edge',
  })
}
