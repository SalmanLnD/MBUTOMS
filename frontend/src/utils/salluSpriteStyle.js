import atlases from './salluSpriteFrames.json';

// Render each pose within its actual bounds, rather than assuming generated
// characters line up with equal grid cells. The PNG itself stays unchanged.
export const spriteFrameStyle = (atlasName, index, size) => {
  const atlas = atlases[atlasName], frame = atlas.frames[index];
  const scale = size * .9 / Math.max(...atlas.frames.map(item => Math.max(item.width, item.height)));
  return {
    position: 'absolute',
    width: frame.width * scale,
    height: frame.height * scale,
    left: (size - frame.width * scale) / 2,
    top: (size - frame.height * scale) / 2,
    backgroundImage: `url('/images/sallu/${atlasName}-atlas.png')`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${atlas.width * scale}px ${atlas.height * scale}px`,
    backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
  };
};
