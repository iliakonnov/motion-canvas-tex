import { makeScene2D } from '@motion-canvas/2d/lib/scenes';
import { createRef } from '@motion-canvas/core/lib/utils';
import { MathTex } from '../components/manim_tex';
import { all, chain, waitFor } from '@motion-canvas/core/lib/flow';
import chroma from 'chroma-js';
import { Layout, Rect, Txt, Node } from '@motion-canvas/2d/lib/components';
import { CodeBlock } from '@motion-canvas/2d/lib/components/CodeBlock';
import { ThreadGenerator } from '@motion-canvas/core/lib/threading';
import js_beautify from 'js-beautify';
import { fadeTransition } from '@motion-canvas/core/lib/transitions';

const LATEX = String.raw;
const PINK = chroma('pink');
const WHITE = chroma('white');
const YELLOW = chroma('yellow');
const RED = chroma('red');

export default makeScene2D(function* (view) {
  const tex = createRef<MathTex>();
  const title = createRef<Txt>();
  const code = createRef<CodeBlock>();
  yield view.add(
    <>
      <Layout layout direction={'column'} width='100%' height='100%' gap={30} padding={30}>
        <Layout height='10%' width='100%' alignItems='center' justifyContent='space-around'>
          <Txt ref={title} text='' fontSize={70} fill='#fff' opacity={0.2} />
        </Layout>
        <Layout height='90%' direction={'row'} grow={1}>
          <Rect width='40%' height='100%' radius={15}>
            <CodeBlock language="js" ref={code} fontSize={35} />
          </Rect>
          <Rect width='60%' height='100%' fill="#262626" radius={15}>
            <Node scale={0.111}>
              <MathTex tex={""} currentColor="white" ref={tex} />
            </Node>
          </Rect>
        </Layout>
      </Layout>
    </>
  );

  yield* fadeTransition();

  function* step(f: () => ThreadGenerator) {
    let source = f.toString();
    source = source.slice(source.indexOf("{") + 1, source.lastIndexOf("}"));
    source = source.replace(/\/\*\!/g, '/*');
    source = js_beautify(source, {
      'indent_size': 2,
      'wrap_line_length': 35,
      'preserve_newlines': true,
      'unescape_strings': true
    })
    yield* all(
      title().text(f.name, 0.5),
      code().code(source, 0.5),
      f(),
    );
    yield* all(
      title().text("", 0.25),
      code().code("", 0.25),
    );
  }

  yield* step(function* welcome() {
    tex().tex(LATEX`
      \begin{gather*}
        \text{MotionCanvas} \\
        \heartsuit \\
        \LaTeX
      \end{gather*}`
    );
    yield* tex().fadeIn(0.8);

    yield* all(...tex()
      .findAll(['normal ♡'])
      .map(x => x.currentColor(RED, 0.5))
    );

    yield* tex().fadeOut(2);
  })

  yield* step(function* basic_math() {
    tex().tex("(a + b)^2");
    yield* tex().fadeIn(0.8);
    yield* waitFor(2);
  });

  yield* step(function* scaling() {
    /*! Use `.transform()`
     * to modify contents.
     * This enables tweening!
     */

    yield* tex().transform(x => {
      x.tex(`
        (a + b)^2
        = (a + b)(a + b)`);
      x.scale(0.8);
    }, 1);
    yield* waitFor(2);
  });

  yield* step(function* transforms() {
    /*! Replace whole tex source
     * inside of transform() call
     */
    yield* tex().transform(x => {
      x.tex(LATEX`
    \begin{align*}
      (a + b)(a+b) = &\\
      = a\cdot a + a \cdot b
        + b \cdot a + b \cdot b &
    \end{align*}`);
    }, 1);

    yield* waitFor(2);
  });

  yield* step(function* more_transforms() {
    yield* tex().transform(x => {
      x.tex(LATEX`
    \begin{align*}
      (a + b)(a+b) = & \\
      = a^2 + ab + ba + b^2
    \end{align*}`);
    }, 1);

    yield* waitFor(2);
  })

  yield* step(function* coloring() {
    /*! Use findAll() to find individual
     * elements */
    const sq = tex().findAll(["a squared", "b squared"]);

    /*! So you can transform them later
     */
    yield* all(...sq.map(x => chain(
      x.currentColor(RED, 1),
      x.currentColor(WHITE, 1),
    )));
  });

  yield* step(function* more_coloring() {
    /*! Find all "a b" and "b a" */
    const els = tex().findAll(["a b", "b a"]);

    /*! Transform each:
     * - first to yellow,
     * - then to white again
     */
    const transforms = els.map(x =>
      chain(
        x.currentColor(YELLOW, 1),
        x.currentColor(WHITE, 1),
      )
    );

    /*! Transform all elements
     * in parallel */
    yield* all(...transforms);
  });

  yield* step(function* transform() {
    yield* tex().transform(x => {
      x.tex(LATEX`
    \begin{align*}
      (a + b)(a+b) = & \\
      = a^2 + 2ab + b^2
    \end{align*}`);
    }, 1);
  })

  yield* step(function* rotations() {
    yield* all(...tex().findAll(["2"]).map(x =>
      chain(
        x.rotation(15, 0.5),
        x.rotation(-15, 0.5),
        x.rotation(0, 0.5),
      )
    ))

    yield* waitFor(2);
  })

  yield* step(function* fadeout() {
    yield* tex().fadeOut(1);
  })
});
