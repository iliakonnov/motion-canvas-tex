import { makeScene2D } from '@motion-canvas/2d/lib/scenes';
import { Circle, Layout, Line, Txt, Rect } from '@motion-canvas/2d/lib/components';
import { slideTransition } from '@motion-canvas/core/lib/transitions';
import { MathTex } from '../components/manim_tex';
import { createSignal } from '@motion-canvas/core/lib/signals';
import { Direction, Vector2 } from '@motion-canvas/core/lib/types';
import { waitFor } from '@motion-canvas/core/lib/flow';
import chroma from 'chroma-js';

export default makeScene2D(function* (view) {
    const radius = createSignal(3);
    const area = createSignal(() => Math.PI * radius() * radius());

    const scale = 100;
    const textStyle = {
        fontWeight: 700,
        fontSize: 56,
        offsetY: -1,
        padding: 20,
        cache: true,
    };

    view.add(
        <Layout layout direction={'column'} width='100%' height='100%' gap={30} padding={30}>
            <Layout height='10%' width='100%' alignItems='center' justifyContent='space-around'>
                <Txt text='Signals' fontSize={70} fill='#fff' opacity={0.2} />
            </Layout>
            <Layout layout={false} height='90%' direction={'row'} grow={1}>
                <Circle
                    width={() => radius() * scale * 2}
                    height={() => radius() * scale * 2}
                    fill={'#e13238'}
                />
                <Line
                    points={[
                        Vector2.zero,
                        () => Vector2.right.scale(radius() * scale),
                    ]}
                    lineDash={[20, 20]}
                    startArrow
                    endArrow
                    endOffset={8}
                    lineWidth={8}
                    stroke={'#242424'}
                />
                <Rect
                    layout
                    x={() => (radius() * scale) / 2}
                    y={scale / 2}
                    fill={'#777'}
                    radius={15}>
                    <MathTex
                        tex={() => `r = d/2 = ${radius().toFixed(2)}`}
                        scale={0.05}
                        currentColor={chroma('orange')}
                        {...textStyle}
                    />
                </Rect>
                <Rect
                    layout
                    y={() => radius() * scale}
                    fill={'#777'}
                    radius={15}>
                    <MathTex
                        tex={() => `A = r^2 = ${area().toFixed(2)}`}
                        scale={0.05}
                        currentColor={chroma('#e13238')}
                        {...textStyle}
                    />
                </Rect>
            </Layout>
        </Layout>
    );

    yield* slideTransition(Direction.Left);

    yield* radius(4, 2).to(3, 2);
    yield* waitFor(1);
});