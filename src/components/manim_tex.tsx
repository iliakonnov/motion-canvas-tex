import { MathML as MathJaxMathML } from 'mathjax-full/js/input/mathml';
import { TeX as MathJaxTeX } from 'mathjax-full/js/input/tex';
import { SVG as MathJaxSVG } from 'mathjax-full/js/output/svg';
import { Sre } from 'mathjax-full/js/a11y/sre';
import { EnrichHandler } from 'mathjax-full/js/a11y/semantic-enrich';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html';
import {
    createSignal,
    SignalValue,
    SimpleSignal,
} from '@motion-canvas/core/lib/signals';
import { OptionList } from 'mathjax-full/js/util/Options';
import { useLogger } from '@motion-canvas/core/lib/utils';
import { initial, signal } from '@motion-canvas/2d/lib/decorators';
import { Svg, SvgImgProps, SvgShape, SvgShapeProps, transformMatchingShapes } from './svg';
import { Color } from '@motion-canvas/core/lib/types';

const Adaptor = liteAdaptor();
const Handler = EnrichHandler(RegisterHTMLHandler(Adaptor), new MathJaxMathML());

const JaxDocument = Handler.create('', {
    InputJax: new MathJaxTeX({ packages: AllPackages }),
    OutputJax: new MathJaxSVG({ fontCache: 'none', internalSpeechTitles: true }),
    enableEnrichment: true,
});
await Sre.setupEngine({
    domain: 'mathspeak',
    style: 'default',
    semantic: true,
    speakText: true,
    speech: 'deep',
    mode: 'http',
    locale: 'en',
}).then(() => Sre.sreReady());

export interface MathTexProps extends SvgImgProps {
    tex?: SignalValue<string>;
    options?: SignalValue<OptionList>;
}

export class MathTex extends Svg {
    private static renderCache: Record<string, string> = {};

    @initial({})
    @signal()
    public declare readonly options: SimpleSignal<OptionList, this>;

    @initial('')
    @signal()
    public declare readonly tex: SimpleSignal<string, this>;

    public override svg: SimpleSignal<string, this> = createSignal(() => this.rendered_svg());

    public constructor(props: MathTexProps) {
        super(props);
    }

    private rendered_svg(): string {
        let tex = this.tex();
        const options = JSON.stringify(this.options());

        // Render props may change the look of the TeX, so we need to cache both
        // source and render props together.
        const key = `${tex}::${options}`;
        if (MathTex.renderCache[key]) {
            return MathTex.renderCache[key];
        }

        // Convert to TeX, look for any errors
        const doc = JaxDocument.convert(tex, this.options());
        const svg = Adaptor.innerHTML(doc);
        if (svg.includes('data-mjx-error')) {
            const errors = svg.match(/data-mjx-error="(.*?)"/);
            if (errors && errors.length > 0) {
                useLogger().error(`Invalid MathJax: ${errors[1]}`);
            }
        }

        MathTex.renderCache[key] = svg;
        return svg;
    }

    protected prepareChildren(svg: string, color: Color): SvgShapeProps[] {
        const result = super.prepareChildren(svg, color);
        useLogger().debug({
            'message': `rendered tex ${this.tex()}`,
            object: result,
        });
        return result;
    }

    public findAll(query: string[] = []): SvgShape[] {
        if (!query.length) {
            return this.elements();
        }
        return this.elements().filter(child => {
            const description: string[] = child.svg().attributes['data-semantic-speech'] as any;
            return description && query.some(q => description.includes(q));
        });
    }

    public * transform(mutate: (x: MathTex) => void, time: number) {
        const transition = this.clone();
        this.parent().add(transition);
        mutate(this);
        yield* transformMatchingShapes(transition, this, time);
        transition.remove();
    }
}