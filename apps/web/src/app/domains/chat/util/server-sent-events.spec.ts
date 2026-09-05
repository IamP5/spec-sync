import { ServerSentEventParser } from './server-sent-events';

describe('ServerSentEventParser', () => {
  it('yields the data of every complete event', () => {
    const parser = new ServerSentEventParser();
    expect(parser.push('data: {"a":1}\n\ndata: {"a":2}\n\n')).toEqual([
      '{"a":1}',
      '{"a":2}',
    ]);
  });

  it('buffers events split across chunks', () => {
    const parser = new ServerSentEventParser();
    expect(parser.push('data: {"pa')).toEqual([]);
    expect(parser.push('rt":true}\n')).toEqual([]);
    expect(parser.push('\n')).toEqual(['{"part":true}']);
  });

  it('joins multi-line data and ignores comments and other fields', () => {
    const parser = new ServerSentEventParser();
    expect(
      parser.push(': keep-alive\n\nevent: x\nid: 1\ndata: one\ndata: two\n\n'),
    ).toEqual(['one\ntwo']);
  });

  it('accepts CRLF line endings', () => {
    const parser = new ServerSentEventParser();
    expect(parser.push('data: crlf\r\n\r\n')).toEqual(['crlf']);
  });
});
