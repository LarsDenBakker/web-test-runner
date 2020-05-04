//@ts-ignore
import tapSpec from 'tap-spec';
export const specReporter = (stream) => {
    stream.pipe(tapSpec()).pipe(process.stdout);
};
