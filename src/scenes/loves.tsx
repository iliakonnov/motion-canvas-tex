import { makeScene2D } from "@motion-canvas/2d";
import { all } from "@motion-canvas/core/lib/flow";
import { fadeTransition, slideTransition } from "@motion-canvas/core/lib/transitions";
import { Direction } from "@motion-canvas/core/lib/types";
import { createRef } from "@motion-canvas/core/lib/utils";
import chroma from "chroma-js";
import { MathTex } from '../components/manim_tex';

export default makeScene2D(function* (view) {
    const tex = createRef<MathTex>();
    yield view.add(
        <>
            <MathTex scale={0.3} tex={""} currentColor="white" ref={tex} />
        </>
    );

    tex().tex(`
      \\begin{gather*}
        \\text{MotionCanvas} \\\\
        \\heartsuit \\\\
        \\LaTeX
      \\end{gather*}`
    );

    const [heart] = tex().findAll(['normal ♡']);
    heart.currentColor(chroma('red'));

    yield* slideTransition(Direction.Left);

    yield* heart.currentColor(chroma('white'), 0.7);

    yield* tex().fadeOut(1);

    yield* fadeTransition();
});