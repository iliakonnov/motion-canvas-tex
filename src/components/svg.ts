import {
    createSignal,
    DEFAULT,
    Signal,
    SignalValue,
    SimpleSignal,
} from '@motion-canvas/core/lib/signals';
import { Shape, ShapeProps, Node, Layout, Rect } from '@motion-canvas/2d/lib/components';
import { CanvasStyleSignal, computed, initial, signal, Vector2LengthSignal } from '@motion-canvas/2d/lib/decorators';
import { applyTransforms, flattenSvg } from '../applyTransforms';
import { INode, parseSync as parseToSvgson } from 'svgson';
import elementToPath from 'element-to-path';
import svgPathBbox from "svg-path-bbox";
import { DesiredLength } from '@motion-canvas/2d/lib/partials';
import chroma from 'chroma-js';
import svgPath from 'svgpath';
import { all, delay } from '@motion-canvas/core/lib/flow';
import { Color, PossibleColor, Vector2, Vector2Signal } from '@motion-canvas/core/lib/types';

export interface SvgImgProps extends ShapeProps {
    svg?: SignalValue<string>;
    children?: string;
    currentColor?: SignalValue<PossibleColor>;
}

export class Svg extends Shape {
    @initial(chroma('black'))
    @signal()
    public declare readonly currentColor: Signal<PossibleColor, Color, this>;

    @initial('')
    @signal()
    public declare readonly svg: SimpleSignal<string, this>;

    public constructor({ children, ...rest }: SvgImgProps) {
        super({ ...rest, layout: false, offset: [0, 0] });
        if (children) {
            this.svg(children);
        }
    }

    @initial(null)
    @signal()
    public declare readonly frozen: SimpleSignal<SvgShape[] | null, this>;

    private static svgCache: Record<string, SvgShapeProps[]> = {};

    //protected override offset: Vector2Signal<this> = createSignal(() => [-1, 1]);

    protected prepareChildren(svg: string, color: Color): SvgShapeProps[] {
        const parsed = parseToSvgson(svg);
        const flat = Array.from(flattenSvg(
            applyTransforms(parsed),
            {
                "stroke": (_, y) => y,
                "strokeWidth": (_, y) => y,
                "fill": (_, y) => y,
                "data-semantic-type": (_, y) => y,
                "data-semantic-role": (_, y) => y,
                "data-semantic-speech": (x, y) => [...(x || []), y]
            },
            {
                'stroke': 'black',
                'fill': 'black',
                'stokeWidth': 1,
            }
        ));

        const result = [];
        let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
        for (let child of flat) {
            let [ox0, oy0, ox1, oy1] = svgPathBbox(elementToPath(child));
            if (![ox0, oy0, ox1, oy1].every(isFinite)) {
                continue;
            }

            // Normalize position
            const [x, y] = [(ox0 + ox1) / 2, (oy0 + oy1) / 2];
            applyTransforms(child, [1, 0, -x, 0, 1, -y, 0, 0, 1]);

            [ox0, oy0, ox1, oy1] = svgPathBbox(elementToPath(child));
            x0 = Math.min(x0, x + ox0);
            y0 = Math.min(y0, y + oy0);
            x1 = Math.max(x1, x + ox1);
            y1 = Math.max(y1, y + oy1);

            const object = { svg: child, currentColor: color, position: new Vector2(x, y) };
            result.push(object);
        }
        if (result.length == 0) {
            return [];
        }

        const offset = new Vector2((x0 + x1) / 2, (y0 + y1) / 2);
        for (let child of result) {
            child.position = child.position.sub(offset);
        }

        // Sort objects left-to-right, top-to-bottom
        result.sort((a, b) => {
            if (a.position.x === b.position.x) {
                return a.position.y - b.position.y;
            } else {
                return a.position.x - b.position.x;
            }
        });

        return result;
    }

    private pool: SvgShape[] = [];

    @computed()
    public elements(): SvgShape[] {
        if (this.frozen() !== null) {
            return this.frozen();
        }

        const svg = this.svg();
        const currentColor = chroma(this.currentColor());
        const key = `${currentColor.css()}:${svg}`;
        if (!Svg.svgCache[key]) {
            Svg.svgCache[key] = this.prepareChildren(svg, currentColor);
        }
        const children = [];
        this.pool = [];
        for (let options of Svg.svgCache[key]) {
            const prev = this.pool.pop();
            let object;
            if (prev !== undefined) {
                prev.applyState(options);
                object = prev;
            } else {
                object = new SvgShape(options)
                object.parent(this);
            };
            children.push(object);
        }
        for (let i = children.length - 1; i >= 0; --i) {
            this.pool.push(children[i]);
        }
        return children;
    }

    public override customHeight: SimpleSignal<number, this> = createSignal(() => {
        let [y0, y1] = [Infinity, -Infinity];
        for (let el of this.elements()) {
            let [ox0, oy0, ox1, oy1] = el.bbox();
            y0 = Math.min(y0, el.position.y() + oy0);
            y1 = Math.max(y1, el.position.y() + oy1);
        }
        return y1 - y0;
    });

    public override customWidth: SimpleSignal<number, this> = createSignal(() => {
        let [x0, x1] = [Infinity, -Infinity];
        for (let el of this.elements()) {
            let [ox0, oy0, ox1, oy1] = el.bbox();
            x0 = Math.min(x0, el.position.x() + ox0);
            x1 = Math.max(x1, el.position.x() + ox1);
        }
        return x1 - x0;
    })

    protected override spawner: SimpleSignal<Node[], this> = createSignal(() => this.elements());

    public * fadeIn(total: number, each: number = null) {
        each ??= total * 0.5;
        const elements = this.elements();
        const inbetween = (total - each) / elements.length;
        const animations = [];
        for (let [i, obj] of elements.entries()) {
            animations.push(obj.fadeIn(each, inbetween * i));
        }
        yield* all(...animations);
    }

    public * fadeOut(total: number, each: number = null) {
        each ??= total * 0.5;
        const elements = this.elements();
        const inbetween = (total - each) / elements.length;
        const animations = [];
        for (let [i, obj] of elements.entries()) {
            animations.push(obj.fadeOut(each, inbetween * i));
        }
        yield* all(...animations);
    }
}

export interface SvgShapeProps extends ShapeProps {
    svg?: SignalValue<INode>;
    currentColor?: SignalValue<PossibleColor>;
}

export class SvgShape extends Shape {
    @initial(chroma('black'))
    @signal()
    public declare readonly currentColor: Signal<PossibleColor, Color, this>;

    @initial('')
    @signal()
    public declare readonly svg: SimpleSignal<INode, this>;

    public constructor({ ...options }: SvgShapeProps) {
        super({ clip: true, layout: false, ...options });
        this.normalized();
    }

    @computed()
    public raw_path(): string {
        return elementToPath(this.svg());
    }

    @computed()
    public bbox(): [number, number, number, number] {
        return svgPathBbox(this.raw_path());
    }

    public override getPath(): Path2D {
        return new Path2D(this.raw_path());
    }

    protected override customWidth: SimpleSignal<DesiredLength, this> = createSignal(() => {
        const [x0, y0, x1, y1] = this.bbox();
        return x1 - x0;
    });

    protected override customHeight: SimpleSignal<DesiredLength, this> = createSignal(() => {
        const [x0, y0, x1, y1] = this.bbox();
        return y1 - y0;
    });

    @signal()
    public override stroke: CanvasStyleSignal<this> = createSignal(() => {
        const style = this.svg().attributes['stroke'];
        if (!style || style === 'none') { return null; }
        if (style === 'currentColor') { return chroma(this.currentColor()) };
        if (!style || !chroma.valid(style)) { return null; }
        return chroma(style);
    })

    @signal()
    public override fill: CanvasStyleSignal<this> = createSignal(() => {
        const style = this.svg().attributes['fill'];
        if (!style || style === 'none') { return null; }
        if (style === 'currentColor') { return chroma(this.currentColor()) };
        if (!style || !chroma.valid(style)) { return null; }
        //return chroma(style);
    })

    public override lineWidth: SimpleSignal<number, this> = createSignal(() => {
        const width = this.svg().attributes['strokeWidth'];
        return width !== undefined ? parseInt(width) : null;
    })

    @computed()
    public normalized(): string {
        const path = svgPath(this.raw_path());
        return path
            .scale(200 / this.height())
            .unarc()
            .unshort()
            .abs()
            .round(3)
            .toString();
    }

    public * fadeIn(time: number, pause: number = 0) {
        const isDefaultFill = this.fill.isInitial();
        const fill: chroma.Color | null = this.fill() as any;
        const lineWidth = this.lineWidth() || 0;

        this.lineWidth(0);
        this.fill(fill?.alpha(0));
        yield* all(
            delay(pause + 0.0 * time, this.lineWidth(lineWidth || 10, 0.3 * time)),
            delay(pause + 0.2 * time, this.fill(fill, 0.8 * time)),
            delay(pause + 0.5 * time, this.lineWidth(lineWidth, 0.5 * time)),
        )
        if (isDefaultFill) { this.fill(DEFAULT); }
    }

    public * fadeOut(time: number, pause: number = 0) {
        const fill: chroma.Color | null = this.fill() as any;
        const lineWidth = this.lineWidth() || 0;

        this.lineWidth(lineWidth);
        this.fill(fill?.alpha(1));
        yield* all(
            delay(pause + 0.0 * time, this.lineWidth(lineWidth || 10, 0.3 * time)),
            delay(pause + 0.2 * time, this.fill(fill?.alpha(0), 0.8 * time)),
            delay(pause + 0.5 * time, this.lineWidth(0, 0.5 * time)),
        )
    }
}

export function* transformMatchingShapes(before: Svg, after: Svg, time: number,) {
    const beforeElements = [...before.elements()];
    beforeElements.sort((a, b) => a.bbox()[0] - a.bbox()[2]);  // sort left-to-right

    const afterElements = [...after.elements()];
    afterElements.sort((a, b) => a.bbox()[2] - a.bbox()[0]);  // sort right-to-left

    const index: Record<string, SvgShape[]> = {};
    for (let child of afterElements) {
        index[child.normalized()] ??= [];
        index[child.normalized()].push(child);
    }

    // Try to map `before` into `after`
    const mapping: [SvgShape, SvgShape][] = beforeElements.map(x => {
        const matched = index[x.normalized()];
        const pair = matched && matched.length
            ? matched.pop()
            : null;
        return [x, pair];
    });
    // Everything else have appeared
    const appeared: SvgShape[] = Object.values(index).flatMap(x => x);

    // Hide everything new
    for (let i of afterElements) {
        i.opacity(0.0);
    }

    // Prepare animations in terms of shapes
    const animations = [];
    for (let [a, b] of mapping) {
        if (b === null) {
            animations.push(a.opacity(0, time));
            continue;
        }

        const scale = after.absoluteScale().mul(new Vector2(a.height() / b.height()));
        animations.push(a.absoluteScale(scale, time));
        animations.push(a.absolutePosition(b.absolutePosition(), time));
        //animations.push(a.opacity(b.opacity(), time));

        a.fill() && b.fill() && animations.push(a.fill(b.fill(), time));
        a.stroke() && b.stroke() && animations.push(a.stroke(b.stroke(), time));
        a.lineWidth() && b.lineWidth() && animations.push(a.lineWidth(b.lineWidth(), time));
    }
    for (let i of appeared) {
        animations.push(i.opacity(1, time));
    }

    before.frozen(beforeElements);
    after.frozen(afterElements);

    yield* all(...animations);

    // Revert everything
    for (let i of afterElements) {
        i.opacity(1);
    }
    after.frozen(null);
    before.remove();
}
