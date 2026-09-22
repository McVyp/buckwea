import { encode } from "@jridgewell/sourcemap-codec";

export interface LineColumn {
    line: number;
    column: number;
}

export interface RawMapping {
    generatedStart: number;
    originalStart: number;
}

export interface SourceMapSegment {
    generatedLine: number;
    generatedColumn: number;
    sourceIndex: number;
    originalLine: number;
    originalColumn: number;
}

export interface SourceMapBuilder {
    sources: string[];
    segments: SourceMapSegment[];
}

export interface SourceMapV3 {
    version: 3;
    sources: string[];
    names: string[];
    mappings: string;
}

export function offsetToLineColumn(source: string, offset: number): LineColumn {
    if (offset < 0 || offset > source.length) {
        throw new Error(
            `Offset ${offset} is out of bounds for source of length ${source.length},`,
        );
    }

    let line = 1;
    let lastNewlineIndex = -1;

    for (let i = 0; i < offset; i++) {
        if (source[i] === '\n') {
            line++;
            lastNewlineIndex = i;
        }
    }

    const column = offset - lastNewlineIndex - 1;

    return {
        line,
        column,
    };
}

export function createSourceMapBuilder(): SourceMapBuilder {
    return {
        sources: [],
        segments: [],
    };
}

export function addModuleMappings(
    builder: SourceMapBuilder,
    sourcePath: string,
    originalSource: string,
    generatedCode: string,
    mappings: RawMapping[],
    startingGeneratedLine: number,
): void {
    let sourceIndex = builder.sources.indexOf(sourcePath);
    if (sourceIndex === -1) {
        sourceIndex = builder.sources.length;
        builder.sources.push(sourcePath);
    }

    for (const mapping of mappings) {
        const generatedPos = offsetToLineColumn(generatedCode, mapping.generatedStart);
        const originalPos = offsetToLineColumn(originalSource, mapping.originalStart);

        builder.segments.push({
            generatedLine: startingGeneratedLine + (generatedPos.line - 1),
            generatedColumn: generatedPos.column,
            sourceIndex,
            originalLine: originalPos.line - 1,
            originalColumn: originalPos.column,
        });
    }
}

export function computeSegments(builder: SourceMapBuilder): number[][][] {
    const maxLine = builder.segments.reduce(
        (max, seg) => Math.max(max, seg.generatedLine),
        -1
    );

    const lines: SourceMapSegment[][] =[];
    for (let i = 0; i <= maxLine; i++) {
        lines.push([]);
    }

    for (const seg of builder.segments) {
        lines[seg.generatedLine].push(seg);
    }

    for (const segs of lines) {
        segs.sort((a, b) => a.generatedColumn - b.generatedColumn);
    }

    return lines.map(segs =>
       segs.map((s) => [
           s.generatedColumn,
           s.sourceIndex,
           s.originalLine,
           s.originalColumn,
       ])
    );
}

export function buildSourceMap(builder: SourceMapBuilder): SourceMapV3 {
    const segments = computeSegments(builder);

    return {
        version: 3,
        sources: builder.sources,
        names: [],
        mappings: encode(segments as unknown as Parameters<typeof encode>[0])
    }
}