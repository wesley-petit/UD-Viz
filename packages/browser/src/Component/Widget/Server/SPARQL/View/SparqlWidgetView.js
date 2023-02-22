import { WidgetView } from '../../../Component/WidgetView/WidgetView';
import { SparqlEndpointResponseProvider } from '../Service/SparqlEndpointResponseProvider';
import { CityObjectProvider } from '../../../CityObjects/ViewModel/CityObjectProvider';
import { SparqlQueryWindow } from './SparqlQueryWindow';
import { LayerManager } from '../../../../Itowns/LayerManager/LayerManager';

/**
 * The SPARQL WidgetView class which manages the SPARQL query window.
 */
export class SparqlWidgetView extends WidgetView {
  /**
   * Creates a new SparqlWidgetView.
   *
   * @param {SparqlEndpointResponseProvider} sparqlProvider The SPARQL Endpoint Response Provider
   * @param {CityObjectProvider} cityObjectProvider The City Object Provider
   * @param {TemporalProvider} temporalProvider The Temporal Provider
   * @param {LayerManager} layerManager The UD-Viz LayerManager.
   * @param {object} configSparqlWidget The sparqlModule view configuration.
   */
  constructor(
    sparqlProvider,
    cityObjectProvider,
    temporalProvider,
    layerManager,
    configSparqlWidget
  ) {
    super();

    /**
     * Contains a SparqlQueryWindow for capturing user input and displaying
     * query results.
     *
     * @type {SparqlQueryWindow}
     */
    this.window = new SparqlQueryWindow(
      sparqlProvider,
      cityObjectProvider,
      temporalProvider,
      layerManager,
      configSparqlWidget
    );
  }

  /**
   * Display the view
   */
  enableView() {
    this.window.appendTo(this.parentElement);
  }

  /**
   *  Close the view
   */
  disableView() {
    this.window.dispose();
  }
}
