import {readFileSync} from 'fs';
import EPubParser from 'epubparser';
import {defaults as xml2jsDefaults, Parser} from 'xml2js';
import {Metadata} from 'epubnew';

async function parse(content: string): Promise<any> {
  return await new Parser(xml2jsDefaults['0.1']).parseStringPromise(content);
}

describe('EPubParser', () => {
  it('parses content file to EPub', async () => {
    const dummyContentFileContent =  readFileSync('./src/dummyContent.opf').toString();
    await EPubParser.parseContentFileToEPub(dummyContentFileContent, null);
  });

  describe('getTagNames', () => {
    it('returns tag names', async () => {
      const parsedXml = await parse('<metadata><publisher>test</publisher><dc:creator>test</dc:creator></metadata>');
      expect(EPubParser.getTagNames(parsedXml)).toEqual(['publisher', 'dc:creator']);
    });
  });

  describe('getCleanTagName', () => {
    it('removes prefixes', async () => {
      expect(EPubParser.getCleanTagName('dc:creator')).toEqual('creator');
    });
  });

  describe('getFirstStringValueFromNode', () => {
    it('returns value from single value node', async () => {
      const parsedXml = await parse('<publisher>test</publisher>');
      expect(EPubParser.getFirstStringValueFromNode(parsedXml)).toEqual('test');
    });

    it('returns empty string when there is no node', async () => {
      const parsedXml = await parse('<publisher></publisher>');
      expect(EPubParser.getFirstStringValueFromNode(parsedXml)).toEqual('');
    });

    it('returns first string value from node list', async () => {
      const parsedXml = await parse('<publisher>test1</publisher><publisher>test2</publisher>');
      expect(EPubParser.getFirstStringValueFromNode(parsedXml)).toEqual('test1');
    });

    it('returns empty string value from node list when first list entry is empty', async () => {
      const parsedXml = await parse('<publisher></publisher><publisher>test2</publisher>')
      expect(EPubParser.getFirstStringValueFromNode(parsedXml)).toEqual('');
    });
  });

  describe('parseMetaNode', () => {
    it('parses meta node for cover', async () => {
      const parsedXml = await parse('<metadata><meta name="cover" content="id-4342825810081545813"/></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseMetaNode(parsedXml, metadata);
      expect(metadata).toEqual({cover: 'id-4342825810081545813'});
    });

    it('parses meta nodes with name and content attributes', async () => {
      const parsedXml = await parse('<metadata><meta><random name="john" content="doe"/></meta></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseMetaNode(parsedXml, metadata);
      expect(metadata).toEqual({john: 'doe'});
    });

    it('parses meta nodes with name only', async () => {
      const parsedXml = await parse('<metadata><meta><random name="john"/></meta></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseMetaNode(parsedXml, metadata);
      expect(metadata).toEqual({john: undefined});
    });

    it('parses meta nodes with property attribute', async () => {
      const parsedXml = await parse('<metadata><meta><foo property="john">doe</foo></meta></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseMetaNode(parsedXml, metadata);
      expect(metadata).toEqual({john: 'doe'});
    });

    it('ignores partial data in meta nodes', async () => {
      const parsedXml = await parse('<metadata><meta><foo property="john"/><bar content="doe"/></meta></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseMetaNode(parsedXml, metadata);
      expect(metadata).toEqual({});
    });
  });

  describe('parseAndSetCreatorNodeData', () => {
    it('parses creator node', async () => {
      const parsedXml = await parse('<creator>John Doe</creator>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetCreatorNodeData(parsedXml, metadata);
      expect(metadata).toEqual({creator: 'John Doe', creatorFileAs: 'John Doe'});
    });

    it('parses creator node with file-as attribute', async () => {
      const parsedXml = await parse('<creator opf:file-as="Doe, John">John Doe</creator>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetCreatorNodeData(parsedXml, metadata);
      expect(metadata).toEqual({creator: 'John Doe', creatorFileAs: 'Doe, John'});
    });

    it('parses creator node with multiple creator nodes', async () => {
      const parsedXml = await parse('<creator>John Doe</creator><creator>Jane Doe</creator>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetCreatorNodeData(parsedXml, metadata);
      expect(metadata).toEqual({creator: 'John Doe', creatorFileAs: 'John Doe'});
    });

    it('parses creator node with multiple creator nodes and file-as attribute', async () => {
      const parsedXml = await parse('<metadata><creator opf:file-as="Doe, John">John Doe</creator><creator>Jane Doe</creator></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetCreatorNodeData(parsedXml['creator'], metadata);
      expect(metadata).toEqual({creator: 'John Doe', creatorFileAs: 'Doe, John'});
    });

    it('parses creator node with multiple creator nodes and file-as attribute when first node has no file-as', async () => {
      const parsedXml = await parse('<metadata><creator>Jane Doe</creator><creator opf:file-as="Doe, John">John Doe</creator></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetCreatorNodeData(parsedXml['creator'], metadata);
      expect(metadata).toEqual({creator: 'Jane Doe', creatorFileAs: 'Jane Doe'});
    });
  });

  describe('parseAndSetIdentifierNodeData', () => {
    it('parses ISBN', async () => {
      const parsedXml = await parse('<dc:identifier opf:scheme="ISBN">978-3-16-148410-0</dc:identifier>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetIdentifierNodeData(parsedXml, metadata);
      expect(metadata).toEqual({ISBN: '978-3-16-148410-0'});
    });

    it('parses UUID', async () => {
      const parsedXml = await parse('<dc:identifier id="uuid">urn:uuid:978-3-16-148410-0</dc:identifier>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetIdentifierNodeData(parsedXml, metadata);
      expect(metadata).toEqual({UUID: '978-3-16-148410-0'});
    });

    it('parses UUID with multiple identifier nodes', async () => {
      const parsedXml = await parse('<metadata><dc:identifier opf:scheme="ISBN">978-3-16-148410-1</dc:identifier><dc:identifier id="uuid">urn:uuid:978-3-16-148410-0</dc:identifier></metadata>');
      const metadata: Metadata = {};
      EPubParser.parseAndSetIdentifierNodeData(parsedXml['dc:identifier'], metadata);
      expect(metadata).toEqual({ISBN: '978-3-16-148410-1', UUID: '978-3-16-148410-0'});
    });
  });
});
