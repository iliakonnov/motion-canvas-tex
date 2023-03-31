import { makeProject } from '@motion-canvas/core';

import scene from './scenes/scene?scene';
import interactive from './scenes/interactive?scene';
import loves from './scenes/loves?scene';

export default makeProject({
  scenes: [scene, interactive, loves],
});
