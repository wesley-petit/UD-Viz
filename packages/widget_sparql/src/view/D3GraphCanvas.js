import { Graph } from '../model/Graph';

import * as d3 from 'd3';
import { getUriLocalname, tokenizeURI } from '@ud-viz/utils_browser';
import * as THREE from 'three';

export class D3GraphCanvas extends THREE.EventDispatcher {
  /**
   * Create a new D3 graph from an RDF JSON object.
   * Adapted from https://observablehq.com/@d3/force-directed-graph#chart and
   * https://www.d3indepth.com/zoom-and-pan/
   *
   * @param {object} configSparqlWidget The sparqlModule configuration.
   * @param {number} configSparqlWidget.height The SVG canvas height.
   * @param {number} configSparqlWidget.width The SVG canvas width.
   * @param {number} configSparqlWidget.fontSize The font size to use for node and link labels.
   * @param {object} configSparqlWidget.namespaceLabels Prefix declarations which will replace text labels in the Legend.
   *                                                    This doesn't (yet) affect the legend font size.
   */
  constructor(configSparqlWidget) {
    super();
    if (
      !configSparqlWidget ||
      !configSparqlWidget.height ||
      !configSparqlWidget.width ||
      !configSparqlWidget.fontSize
    ) {
      console.log(configSparqlWidget);
      throw 'The given "configSparqlWidget" configuration is incorrect.';
    }
    this.height = configSparqlWidget.height;
    this.width = configSparqlWidget.width;
    this.fontSize = configSparqlWidget.fontSize;
    this.knownNamespaceLabels = configSparqlWidget.namespaceLabels;
    this.id = 'd3_graph-' + Math.random().toString(36).substring(7);
    this.svg = d3
      .create('svg')
      .attr('id', this.id)
      .attr('class', 'd3_graph')
      .attr('viewBox', [0, 0, this.width, this.height])
      .style('display', 'hidden');
    this.data = new Graph();
    this.node = null;
    this.node_label = null;
    this.link = null;
    this.link_label = null;
    this.colorSetOrScale = d3.scaleOrdinal(d3.schemeCategory10);
  }

  // / Data Functions ///

  /**
   * Clear and update the d3 SVG canvas based on the data from a graph dataset. Also apply event dispatchers
   *
   * @param {object} response an RDF JSON object ideally formatted by this.formatResponseData().
   */
  update(response) {
    this.clearCanvas();
    this.data.formatResponseData(response);

    const links = this.data.links.map((d) => Object.create(d));
    const nodes = this.data.nodes.map((d) => Object.create(d));
    const legend = this.prefixLegend(this.data.typeList);
    const colorScale = this.colorSetOrScale;
    const setColor = function (d, default_color, override_color = undefined) {
      if (override_color && colorScale) return override_color;
      else if (colorScale) return colorScale(d);
      return default_color;
    };

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3.forceLink(links).id((d) => d.id)
      )
      .force('charge', d3.forceManyBody().strength(-60))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2));

    const zoom = d3.zoom().on('zoom', this.handleZoom);

    this.svg.call(zoom);

    this.link = this.svg
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.8)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', (d) => Math.sqrt(d.value));

    this.node = this.svg
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 4)
      .attr('stroke-opacity', 0.8)
      .attr('stroke-width', 0.75)
      .attr('stroke', (d) => setColor(d.color_id, '#ddd', '#111'))
      .attr('fill', (d) => setColor(d.color_id, 'black'))
      .on('click', (event, datum) => {
        this.dispatchEvent({
          type: 'click',
          message: 'node click event',
          event: event,
          datum: datum,
          graphId: this.id,
        });
      })
      .on('mouseover', (event, datum) => {
        this.dispatchEvent({
          type: 'mouseover',
          message: 'node mouseover event',
          event: event,
          datum: datum,
          graphId: this.id,
        });
      })
      .on('mouseout', (event, datum) => {
        this.dispatchEvent({
          type: 'mouseout',
          message: 'node mouseout event',
          event: event,
          datum: datum,
          graphId: this.id,
        });
      })
      .call(this.drag(simulation));

    this.node.append('title').text((d) => d.id);

    this.node_label = this.svg
      .selectAll('.node_label')
      .data(nodes)
      .enter()
      .append('text')
      .text(function (d) {
        return getUriLocalname(d.id);
      })
      .style('text-anchor', 'middle')
      .style('font-family', 'Arial')
      .style('font-size', this.fontSize)
      .style('text-shadow', '1px 1px black')
      .style('fill', 'grey')
      .style('opacity', '0.5')
      // .style('fill', 'white')
      // .style('visibility', 'hidden')
      .style('pointer-events', 'none')
      .attr('class', 'node_label');

    this.link_label = this.svg
      .selectAll('.link_label')
      .data(links)
      .enter()
      .append('text')
      .text(function (d) {
        return getUriLocalname(d.label);
      })
      .style('text-anchor', 'middle')
      .style('font-family', 'Arial')
      .style('font-size', this.fontSize)
      .style('text-shadow', '1px 1px black')
      .style('fill', 'grey')
      .style('opacity', '0.5')
      // .style('fill', 'white')
      // .style('visibility', 'hidden')
      .style('pointer-events', 'none')
      .attr('class', 'link_label');

    simulation.on('tick', () => {
      this.node_label
        .attr('x', function (d) {
          return d.x;
        })
        .attr('y', function (d) {
          return d.y - 10;
        });
      this.link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);
      this.link_label
        .attr('x', function (d) {
          return (d.source.x + d.target.x) / 2;
        })
        .attr('y', function (d) {
          return (d.source.y + d.target.y) / 2;
        });
      this.node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
    });

    // Create legend
    if (legend.length > 0) {
      this.svg
        .append('text')
        .attr('x', 12)
        .attr('y', 24)
        .style('font-size', '18px')
        .style('text-decoration', 'underline')
        .text('Legend')
        .style('fill', 'FloralWhite');

      // legend colors
      this.svg
        .append('g')
        .attr('stroke', '#111')
        .attr('stroke-width', 1)
        .selectAll('rect')
        .data(legend)
        .join('rect')
        .attr('x', 12)
        .attr('y', (d, i) => 32 + i * 16)
        .attr('width', 10)
        .attr('height', 10)
        .style('fill', (d, i) => {
          return setColor(i, '#000');
        })
        .append('title')
        .text((d) => d);

      // legend text
      this.svg
        .append('g')
        .selectAll('text')
        .data(legend)
        .join('text')
        .attr('x', 26)
        .attr('y', (d, i) => 41 + i * 16)
        .text((d) => d)
        .style('fill', 'FloralWhite')
        .style('font-size', '14px');
    }
  }

  /**
   * Getter for retrieving the d3 svg.
   *
   * @returns {d3.svg.node} return the D3 svg object that represents the graph's "canvas"
   */
  get canvas() {
    return this.svg.node();
  }

  /**
   * Hide the graph SVG
   */
  hide() {
    this.svg.style('display', 'hidden');
  }

  /**
   * Show the graph SVG
   */
  show() {
    this.svg.style('display', 'visible');
  }

  /**
   * Remove nodes and lines from the SVG.
   */
  clearCanvas() {
    this.svg.selectAll('g').remove();
    this.svg.selectAll('text').remove();
  }

  // / Interface Functions ///

  /**
   * Create a drag effect for graph nodes within the context of a force simulation
   *
   * @param {d3.forceSimulation} simulation The active D3 force simulation of the graph
   * @returns {d3.drag} a D3 drag function to enable dragging nodes within the graph
   */
  drag(simulation) {
    /**
     *
     * @param {d3.D3DragEvent} event the drag event containing information on which node is being clicked and dragged
     */
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    /**
     *
     * @param {d3.D3DragEvent} event the drag event containing information on which node is being clicked and dragged
     */
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    /**
     *
     * @param {d3.D3DragEvent} event the drag event containing information on which node is being clicked and dragged
     */
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3
      .drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }

  /**
   * A handler function for selecting elements to transform during a zoom event
   *
   * @param {d3.D3ZoomEvent} event the zoom event containing information on how the svg canvas is being translated and scaled
   */
  handleZoom(event) {
    d3.selectAll(`#${this.id} g`)
      .filter((d, i) => i < 2)
      .attr('height', '100%')
      .attr('width', '100%')
      // .attr('transform', event.transform)
      .attr(
        'transform',
        'translate(' +
          event.transform.x +
          ',' +
          event.transform.y +
          ') scale(' +
          event.transform.k +
          ')'
      );
    d3.selectAll(`#${this.id} text.node_label`)
      .style('font-size', this.fontSize / event.transform.k + 'px')
      .attr(
        'transform',
        'translate(' +
          event.transform.x +
          ',' +
          event.transform.y +
          ') scale(' +
          event.transform.k +
          ')'
      );
    d3.selectAll(`#${this.id} text.link_label`)
      .style('font-size', this.fontSize / event.transform.k + 'px')
      .attr(
        'transform',
        'translate(' +
          event.transform.x +
          ',' +
          event.transform.y +
          ') scale(' +
          event.transform.k +
          ')'
      );
  }

  /**
   * Check if a list of URIs have namespaces in the known namespace list. If so, replace
   * the namespace of the URI with a prefix. The known namespace list is declared in a
   * configuration file.
   *
   * @param {Array<string>} legendContent the list of uris representing the content of the legend0
   * @returns {Array<string>} returns the legend content with prefixes
   */
  prefixLegend(legendContent) {
    const prefixedLegendContent = [];
    for (const uri in legendContent) {
      const tURI = tokenizeURI(legendContent[uri]);
      if (Object.keys(this.knownNamespaceLabels).includes(tURI.namespace)) {
        prefixedLegendContent.push(
          `${this.knownNamespaceLabels[tURI.namespace]}:${tURI.localname}`
        );
      } else {
        prefixedLegendContent.push(legendContent[uri]);
      }
    }
    return prefixedLegendContent;
  }
}
