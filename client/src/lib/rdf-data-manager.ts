import { Store, parse, Namespace, Statement, sym, lit } from 'rdflib';

export interface RDFNode {
  id: string;
  label: string;
  type: string;
  uri: string;
  properties: Record<string, any>;
  x?: number;
  y?: number;
}

export interface RDFLink {
  id: string;
  source: string;
  target: string;
  predicate: string;
  label: string;
}

export interface RDFGraphData {
  nodes: RDFNode[];
  links: RDFLink[];
  namespaces: Record<string, string>;
}

export class RDFDataManager {
  private store: Store;
  private namespaces: Map<string, any>;
  private loaded: boolean;

  constructor() {
    this.store = new Store();
    this.namespaces = new Map();
    this.loaded = false;
    this.setupCommonNamespaces();
  }

  private setupCommonNamespaces() {
    // Common RDF namespaces
    this.namespaces.set('rdf', Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#'));
    this.namespaces.set('rdfs', Namespace('http://www.w3.org/2000/01/rdf-schema#'));
    this.namespaces.set('owl', Namespace('http://www.w3.org/2002/07/owl#'));
    this.namespaces.set('foaf', Namespace('http://xmlns.com/foaf/0.1/'));
    this.namespaces.set('dc', Namespace('http://purl.org/dc/elements/1.1/'));
    this.namespaces.set('dcterms', Namespace('http://purl.org/dc/terms/'));
    this.namespaces.set('skos', Namespace('http://www.w3.org/2004/02/skos/core#'));
    this.namespaces.set('ex', Namespace('http://example.org/'));
  }

  async loadRDFData(data: string, format: string = 'text/turtle', baseURI: string = ''): Promise<void> {
    try {
      const mimeType = this.getMimeType(format);
      await new Promise<void>((resolve, reject) => {
        parse(data, this.store, baseURI, mimeType, (error, store) => {
          if (error) {
            reject(new Error(`Failed to parse RDF data: ${error.message}`));
          } else {
            this.loaded = true;
            this.extractNamespacesFromStore();
            resolve();
          }
        });
      });
    } catch (error) {
      throw new Error(`RDF loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getMimeType(format: string): string {
    const formatMap: Record<string, string> = {
      'turtle': 'text/turtle',
      'ttl': 'text/turtle',
      'rdf': 'application/rdf+xml',
      'rdf/xml': 'application/rdf+xml',
      'xml': 'application/rdf+xml',
      'n3': 'text/n3',
      'nt': 'application/n-triples',
      'jsonld': 'application/ld+json',
      'json-ld': 'application/ld+json'
    };
    return formatMap[format.toLowerCase()] || 'text/turtle';
  }

  private extractNamespacesFromStore(): void {
    // Extract namespace prefixes from loaded data
    const statements = this.store.statements;
    const uris = new Set<string>();
    
    statements.forEach(stmt => {
      if ((stmt.subject as any).uri) uris.add((stmt.subject as any).uri);
      if ((stmt.predicate as any).uri) uris.add((stmt.predicate as any).uri);
      if ((stmt.object as any).uri) uris.add((stmt.object as any).uri);
    });

    // Auto-detect common namespace patterns
    uris.forEach(uri => {
      const segments = uri.split(/[#\/]/);
      if (segments.length > 1) {
        const base = segments.slice(0, -1).join('/') + (uri.includes('#') ? '#' : '/');
        // Add to namespaces if not already present
        if (!Array.from(this.namespaces.values()).some(ns => ns('').uri === base)) {
          const prefix = this.generatePrefix(base);
          this.namespaces.set(prefix, Namespace(base));
        }
      }
    });
  }

  private generatePrefix(uri: string): string {
    // Generate a reasonable prefix from URI
    const domain = uri.match(/https?:\/\/([^\/]+)/);
    if (domain) {
      const parts = domain[1].split('.');
      return parts[parts.length - 2] || 'ns';
    }
    return 'ns';
  }

  executeSPARQLQuery(queryString: string): RDFGraphData {
    if (!this.loaded) {
      throw new Error('No RDF data loaded. Please load data first.');
    }

    try {
      // Simple SPARQL query executor for basic SELECT queries
      // This is a simplified implementation - for production use, consider SPARQL.js
      const results = this.executeSELECTQuery(queryString);
      return this.convertResultsToGraphData(results);
    } catch (error) {
      throw new Error(`SPARQL query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private executeSELECTQuery(queryString: string): any[] {
    // Parse basic SELECT queries
    const selectMatch = queryString.match(/SELECT\s+(.*?)\s+WHERE\s*{(.*?)}/is);
    if (!selectMatch) {
      throw new Error('Only SELECT queries are currently supported');
    }

    const variables = selectMatch[1].trim().split(/\s+/).map(v => v.replace('?', ''));
    const whereClause = selectMatch[2].trim();

    // Parse simple triple patterns
    const triples = this.parseTriplePatterns(whereClause);
    const results: any[] = [];

    // Execute each triple pattern against the store
    triples.forEach(triple => {
      const statements = this.store.statementsMatching(
        triple.subject ? sym(triple.subject) : undefined,
        triple.predicate ? sym(triple.predicate) : undefined,
        triple.object ? (triple.object.startsWith('"') ? lit(triple.object) : sym(triple.object)) : undefined
      );

      statements.forEach(stmt => {
        const binding: Record<string, any> = {};
        if (triple.subject?.startsWith('?')) {
          binding[triple.subject.substring(1)] = stmt.subject;
        }
        if (triple.predicate?.startsWith('?')) {
          binding[triple.predicate.substring(1)] = stmt.predicate;
        }
        if (triple.object?.startsWith('?')) {
          binding[triple.object.substring(1)] = stmt.object;
        }
        results.push(binding);
      });
    });

    return results;
  }

  private parseTriplePatterns(whereClause: string): Array<{subject?: string, predicate?: string, object?: string}> {
    // Simple triple pattern parser
    const patterns = whereClause.split('.').map(p => p.trim()).filter(p => p);
    return patterns.map(pattern => {
      const parts = pattern.split(/\s+/);
      return {
        subject: parts[0],
        predicate: parts[1],
        object: parts.slice(2).join(' ')
      };
    });
  }

  private convertResultsToGraphData(results: any[]): RDFGraphData {
    const nodes = new Map<string, RDFNode>();
    const links: RDFLink[] = [];

    results.forEach(result => {
      Object.values(result).forEach((value: any) => {
        if (value && value.uri) {
          const nodeId = value.uri;
          if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
              id: nodeId,
              label: this.extractLabel(value.uri),
              type: this.inferNodeType(value.uri),
              uri: value.uri,
              properties: this.getNodeProperties(value.uri)
            });
          }
        }
      });
    });

    // Create links from RDF statements
    this.store.statements.forEach(stmt => {
      if (stmt.subject.uri && stmt.object.uri) {
        links.push({
          id: `${stmt.subject.uri}-${stmt.predicate.uri}-${stmt.object.uri}`,
          source: stmt.subject.uri,
          target: stmt.object.uri,
          predicate: stmt.predicate.uri,
          label: this.extractLabel(stmt.predicate.uri)
        });
      }
    });

    return {
      nodes: Array.from(nodes.values()),
      links,
      namespaces: Object.fromEntries(
        Array.from(this.namespaces.entries()).map(([prefix, ns]) => [prefix, ns('').uri])
      )
    };
  }

  private extractLabel(uri: string): string {
    // Extract a human-readable label from URI
    const fragment = uri.split('#').pop();
    const segment = uri.split('/').pop();
    const label = fragment || segment || uri;
    
    // Convert camelCase and snake_case to readable format
    return label
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private inferNodeType(uri: string): string {
    // Try to infer node type from RDF statements
    const typeStatements = this.store.statementsMatching(
      sym(uri), 
      this.namespaces.get('rdf')!('type'), 
      undefined
    );
    
    if (typeStatements.length > 0) {
      return this.extractLabel(typeStatements[0].object.uri || 'Resource');
    }

    // Fallback to URI-based inference
    if (uri.includes('Person') || uri.includes('person')) return 'Person';
    if (uri.includes('Organization') || uri.includes('org')) return 'Organization';
    if (uri.includes('Place') || uri.includes('location')) return 'Place';
    
    return 'Resource';
  }

  private getNodeProperties(uri: string): Record<string, any> {
    const properties: Record<string, any> = {};
    const statements = this.store.statementsMatching(sym(uri), undefined, undefined);
    
    statements.forEach(stmt => {
      const predicate = this.extractLabel(stmt.predicate.uri || '');
      const value = stmt.object.value || stmt.object.uri || stmt.object.toString();
      
      if (properties[predicate]) {
        if (Array.isArray(properties[predicate])) {
          properties[predicate].push(value);
        } else {
          properties[predicate] = [properties[predicate], value];
        }
      } else {
        properties[predicate] = value;
      }
    });
    
    return properties;
  }

  getGraphData(): RDFGraphData {
    if (!this.loaded) {
      return { nodes: [], links: [], namespaces: {} };
    }

    return this.convertResultsToGraphData([]);
  }

  clearStore(): void {
    this.store = new Store();
    this.loaded = false;
  }

  getTripleCount(): number {
    return this.store.statements.length;
  }

  getNamespaces(): Record<string, string> {
    return Object.fromEntries(
      Array.from(this.namespaces.entries()).map(([prefix, ns]) => [prefix, ns('').uri])
    );
  }
}