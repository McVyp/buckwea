export interface LineColumn {
    line: number;
    column: number;
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