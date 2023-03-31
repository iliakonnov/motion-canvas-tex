// TODO: Replace this with svgpath

import * as parseD from 'd-path-parser';
import { Command } from 'd-path-parser';
import { INode } from 'svgson';

function formatNumber(n: number): string {
    if (isNaN(n)) console.warn('Found invalid number: ', n);
    return n.toString();
}

function float(n: number): string {
    return formatNumber(n);
}

function floatPair(x: number, y: number): string {
    return `${float(x)},${float(y)}`;
}

function boolean(x: boolean): string {
    return x ? '1' : '0';
}

function serializeD(segments: Command[]): string {
    return segments
        .map(segment => {
            switch (segment.code) {
                case 'T':
                case 'M':
                case 'm':
                case 'L':
                case 'l':
                    return `${segment.code}${floatPair(segment.end.x, segment.end.y)}`;
                case 'H':
                case 'h':
                case 'V':
                case 'v':
                    return `${segment.code}${float(segment.value)}`;
                case 'C':
                case 'c': {
                    const { code, cp1, cp2, end } = segment;
                    return `${code}${floatPair(cp1.x, cp1.y)} ${floatPair(cp2.x, cp2.y)} ${floatPair(end.x, end.y)}`;
                }
                case 'S':
                case 's':
                case 'Q':
                case 'q': {
                    const { code, cp, end } = segment;
                    return `${code}${floatPair(cp.x, cp.y)} ${floatPair(end.x, end.y)}`;
                }
                case 'A':
                case 'a': {
                    const { code, radii, rotation, large, clockwise, end } = segment;
                    return `${code}${floatPair(radii.x, radii.y)} ${float(rotation)} ${boolean(large)} ${boolean(
                        clockwise,
                    )} ${floatPair(end.x, end.y)}`;
                }
                default:
                    return `${segment.code}`;
            }
        })
        .join(' ');
}

type Vector = [number, number, number];
type Matrix = [number, number, number, number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function multiply(a: Matrix, b: Matrix): Matrix {
    return [
        a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
        a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
        a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
        a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
        a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
        a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
        a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
        a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
        a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
    ];
}

if (JSON.stringify(multiply(IDENTITY, IDENTITY)) != JSON.stringify(IDENTITY)) {
    alert("aa");
}

function multiplyVector(a: Matrix, v: Vector): Vector {
    return [
        a[0] * v[0] + a[1] * v[1] + a[2] * v[2],
        a[3] * v[0] + a[4] * v[1] + a[5] * v[2],
        a[6] * v[0] + a[7] * v[1] + a[8] * v[2],
    ];
}

function transformX(matrix: Matrix, x: number) {
    const [nx] = multiplyVector(matrix, [x, 0, 1]);
    return nx;
}

function transformY(matrix: Matrix, y: number) {
    const [, ny] = multiplyVector(matrix, [0, y, 1]);
    return ny;
}

function transformXY(matrix: Matrix, x: number, y: number) {
    return multiplyVector(matrix, [x, y, 1]);
}

function transformDX(matrix: Matrix, dx: number) {
    const [x0] = multiplyVector(matrix, [0, 0, 1]);
    const [x1] = multiplyVector(matrix, [dx, 0, 1]);
    return x1 - x0;
}
function transformDY(matrix: Matrix, dy: number) {
    const [, y0] = multiplyVector(matrix, [0, 0, 1]);
    const [, y1] = multiplyVector(matrix, [0, dy, 1]);
    return y1 - y0;
}

function parseTransform(transform: string): [Matrix, string] {
    let matrix: Matrix = IDENTITY;
    let match;
    const re = /(\w+)\(([-0-9e.]+\s*([,\s]\s*[-0-9e.]+)*)\)/g;
    const remainingTransforms = [];
    while ((match = re.exec(transform))) {
        const [, op, paramsString] = match;
        const params = paramsString.split(/[,\s]+/).map(parseFloat);
        let m: Matrix;
        switch (op) {
            case 'translate':
                let [tx, ty] = params;
                m = [1, 0, tx, 0, 1, ty, 0, 0, 1];
                matrix = multiply(matrix, m);
                break;
            case 'scale':
                let [sx, sy] = params.length == 1 ? [params[0], params[0]] : params;
                m = [sx, 0, 0, 0, sy, 0, 0, 0, 1];
                matrix = multiply(matrix, m);
                break;
            case 'rotate':
                let [a] = params;
                a = a * Math.PI / 180;
                m = [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
                matrix = multiply(matrix, m);
                break;
            default:
                console.warn(`Unknown transform ${op}`);
                remainingTransforms.push(match[0]);
        }
    }
    return [matrix, remainingTransforms.join(' ')];
}

function applyMatrixToD(matrix: Matrix, d: string): string {
    const segments = parseD(d);
    for (let segment of segments) {
        switch (segment.code) {
            case 'M':
            case 'L':
                const [mx, my] = transformXY(matrix, segment.end.x, segment.end.y);
                segment.end.x = mx;
                segment.end.y = my;
                break;
            case 'm':
            case 'l':
                segment.end.x = transformDX(matrix, segment.end.x); segment.end.y = transformDY(matrix, segment.end.y);
                break;
            case 'H':
                segment.value = transformX(matrix, segment.value);
                break;
            case 'h':
                segment.value = transformDX(matrix, segment.value);
                break;
            case 'V':
                segment.value = transformY(matrix, segment.value);
                break;
            case 'v':
                segment.value = transformDY(matrix, segment.value);
                break;
            case 'C': {
                const [cp1x, cp1y] = transformXY(matrix, segment.cp1.x, segment.cp1.y);
                const [cp2x, cp2y] = transformXY(matrix, segment.cp2.x, segment.cp2.y);
                const [endx, endy] = transformXY(matrix, segment.end.x, segment.end.y);
                segment.cp1.x = cp1x; segment.cp1.y = cp1y;
                segment.cp2.x = cp2x; segment.cp2.y = cp2y;
                segment.end.x = endx; segment.end.y = endy;
                break;
            }
            case 'c':
                segment.cp1.x = transformDX(matrix, segment.cp1.x); segment.cp1.y = transformDY(matrix, segment.cp1.y);
                segment.cp2.x = transformDX(matrix, segment.cp2.x); segment.cp2.y = transformDY(matrix, segment.cp2.y);
                segment.end.x = transformDX(matrix, segment.end.x); segment.end.y = transformDY(matrix, segment.end.y);
                break;
            case 'Q':
            case 'S': {
                const [cpx, cpy] = transformXY(matrix, segment.cp.x, segment.cp.y);
                const [endx, endy] = transformXY(matrix, segment.end.x, segment.end.y);
                segment.cp.x = cpx; segment.cp.y = cpy;
                segment.end.x = endx; segment.end.y = endy;
                break;
            }
            case 'q':
            case 's':
                segment.cp.x = transformDX(matrix, segment.cp.x); segment.cp.y = transformDY(matrix, segment.cp.y);
                segment.end.x = transformDX(matrix, segment.end.x); segment.end.y = transformDY(matrix, segment.end.y);
                break;
            case 'T': {
                const [endx, endy] = transformXY(matrix, segment.end.x, segment.end.y);
                segment.end.x = endx; segment.end.y = endy;
                break;
            }
            case 'A':
                {
                    const [endx, endy] = transformXY(matrix, segment.end.x, segment.end.y);
                    segment.end.x = endx; segment.end.y = endy;
                    segment.radii.x = transformDX(matrix, segment.radii.x); segment.radii.y = transformDY(matrix, segment.radii.y);
                    if (hasRotation(matrix)) {
                        console.warn(`Rotating of arc path segments is not yet implemented: ${d}`);
                    }
                    break;
                }
            case 'a':
                segment.end.x = transformDX(matrix, segment.end.x); segment.end.y = transformDY(matrix, segment.end.y);
                segment.radii.x = transformDX(matrix, segment.radii.x); segment.radii.y = transformDY(matrix, segment.radii.y);
                if (hasRotation(matrix)) {
                    console.warn(`Rotating of arc path segments is not yet implemented: ${d}`);
                }
                break;
            case 'Z':
                break;
            default:
                console.warn(`Segment transform not implemented: ${segment.code}`, segment);
        }
    }
    return serializeD(segments);
}

function applyMatrixToPoints(matrix: Matrix, points: string): string {
    const p = points.split(' ');
    const newPoints = [];
    for (let i = 0; i < p.length; i += 2) {
        const x = parseFloat(p[i]);
        const y = parseFloat(p[i + 1]);
        const vector: Vector = [x, y, 1];
        const [nx, ny] = multiplyVector(matrix, vector);
        newPoints.push(formatNumber(nx));
        newPoints.push(formatNumber(ny));
    }
    return newPoints.join(' ');
}

function applyMatrixToX(matrix: Matrix, x: string): string {
    return formatNumber(transformX(matrix, parseFloat(x)));
}

function applyMatrixToY(matrix: Matrix, y: string): string {
    return formatNumber(transformY(matrix, parseFloat(y)));
}

function applyMatrixToWidth(matrix: Matrix, width: string): string {
    return formatNumber(transformDX(matrix, parseFloat(width)));
}

function applyMatrixToHeight(matrix: Matrix, height: string): string {
    return formatNumber(transformDY(matrix, parseFloat(height)));
}

function applyMatrixToR(matrix: Matrix, r: string): string {
    const rx = applyMatrixToWidth(matrix, r);
    const ry = applyMatrixToHeight(matrix, r);
    if (rx !== ry) {
        console.warn('Circle transformed into an ellipsis... not implemeted yet.');
    }
    return rx;
}

function hasRotation(matrix: Matrix): boolean {
    return matrix[1] !== 0 || matrix[3] !== 0;
}

function hasScale(matrix: Matrix): boolean {
    return matrix[0] !== 1 || matrix[4] !== 1;
}

function convertRectToPolygon(el: INode) {
    // Punt on rects with corner radii
    if (el.attributes['rx']) return;
    el.name = 'polygon';
    const x = parseFloat(el.attributes['x'] as string);
    const y = parseFloat(el.attributes['y'] as string);
    const width = parseFloat(el.attributes['width'] as string);
    const height = parseFloat(el.attributes['height'] as string);
    const points = [x, y, x + width, y, x + width, y + height, x, y + height];
    el.attributes['points'] = points.map(formatNumber).join(' ');
    delete el.attributes['x'];
    delete el.attributes['y'];
    delete el.attributes['width'];
    delete el.attributes['height'];
    return el;
}

function convertPolygonToRect(el: INode) {
    const [x0, y0, x1, y1, x2, y2, x3, y3, ...rest] = (el.attributes['points'] as string).split(' ').map(parseFloat);
    if (rest.length > 0) {
        if (rest.length !== 2) return;
        const [x4, y4] = rest;
        if (x0 !== x4 || y0 !== y4) return;
    }
    let width = 0;
    let height = 0;
    if (y0 === y1 && x1 === x2 && y2 === y3 && x3 === x0) {
        width = Math.abs(x1 - x0);
        height = Math.abs(y2 - y1);
    } else if (x0 === x1 && y1 === y2 && x2 === x3 && y3 === y0) {
        width = Math.abs(x2 - x1);
        height = Math.abs(y1 - y0);
    } else {
        return;
    }
    el.name = 'rect';
    el.attributes['x'] = formatNumber(Math.min(x0, x1, x2, x3));
    el.attributes['y'] = formatNumber(Math.min(y0, y1, y2, y3));
    el.attributes['width'] = formatNumber(width);
    el.attributes['height'] = formatNumber(height);
    delete el.attributes['points'];
    return el;
}

const transformsByElement = {
    rect(el: INode, matrix: Matrix) {
        if (hasRotation(matrix) || hasScale(matrix)) {
            el = convertRectToPolygon(el);
            if (el.name.toLowerCase() !== 'polygon') return false;
            transformsByElement.polygon(el, matrix);
            el = convertPolygonToRect(el);
            return true;
        } else {
            el.attributes['x'] = applyMatrixToX(matrix, el.attributes['x'] as string);
            el.attributes['y'] = applyMatrixToY(matrix, el.attributes['y'] as string);
            el.attributes['width'] = applyMatrixToWidth(matrix, el.attributes['width'] as string);
            el.attributes['height'] = applyMatrixToHeight(matrix, el.attributes['height'] as string);
            return true;
        }
    },

    polygon(el: INode, matrix: Matrix) {
        el.attributes['points'] = applyMatrixToPoints(matrix, el.attributes['points'] as string);
        return true;
    },

    polyline(el: INode, matrix: Matrix) {
        el.attributes['points'] = applyMatrixToPoints(matrix, el.attributes['points'] as string);
        return true;
    },

    path(el: INode, matrix: Matrix) {
        el.attributes['d'] = applyMatrixToD(matrix, el.attributes['d'] as string);
        return true;
    },

    circle(el: INode, matrix: Matrix) {
        el.attributes['cx'] = applyMatrixToX(matrix, el.attributes['cx'] as string);
        el.attributes['cy'] = applyMatrixToY(matrix, el.attributes['cy'] as string);
        el.attributes['r'] = applyMatrixToR(matrix, el.attributes['r'] as string);
        return true;
    },
};

export function applyTransforms(el: INode, m: Matrix = IDENTITY): INode {
    let matrix = null;
    if (el.attributes['transform']) {
        [matrix] = parseTransform(el.attributes['transform'] as string);
    }
    const fullMatrix = !!matrix ? multiply(m, matrix) : m;

    const transform = transformsByElement[el.name.toLowerCase() as keyof typeof transformsByElement];
    if (transform) {
        const success = transform(el, fullMatrix);
        if (success) {
            delete el.attributes['transform'];
        } else {
            console.warn('failed to remove transform');
        }
    }
    for (let child of el.children) {
        applyTransforms(child, fullMatrix);
    }

    return el;
}

type Reduce<T> = (a: T | undefined, b: any) => T;

export function* flattenSvg(el: INode, attributes: Record<string, Reduce<any>> = {}, inherited: Record<string, any> = {}): Generator<INode> {
    inherited = { ...inherited };
    for (let key of Object.keys(attributes)) {
        if (el.attributes[key]) {
            inherited[key] = attributes[key](inherited[key], el.attributes[key]);
        }
    }
    for (let child of el.children) {
        yield* flattenSvg(child, attributes, inherited)
    }
    if (!el.children.length) {
        yield { ...el, attributes: { ...el.attributes, ...inherited } };
    }
}
