import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { plannerNode } from './plannerNode.js';
import { weatherNode } from './weatherNode.js';
import { attractionsNode } from './attractionsNode.js';
import { accommodationNode } from './accommodationNode.js';
import { budgetNode } from './budgetNode.js';
import { personalizationNode } from './personalizationNode.js';
import { composerNode } from './composerNode.js';

// StateGraph annotation schema
export const TripStateAnnotation = Annotation.Root({
  rawRequest: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => '',
  }),
  destination: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => '',
  }),
  startDate: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => '',
  }),
  endDate: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => '',
  }),
  budgetTier: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => '',
  }),
  interests: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => [],
  }),
  weather: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
  }),
  attractions: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => [],
  }),
  accommodationOptions: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => [],
  }),
  budgetEstimate: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
  }),
  personalizedContent: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => [],
  }),
  itinerary: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => [],
  }),
  finalItinerary: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
  }),
});

// Build workflow with 5 parallel branches flowing from plannerNode into composerNode
const workflow = new StateGraph(TripStateAnnotation)
  .addNode('plannerNode', plannerNode)
  .addNode('weatherNode', weatherNode)
  .addNode('attractionsNode', attractionsNode)
  .addNode('accommodationNode', accommodationNode)
  .addNode('budgetNode', budgetNode)
  .addNode('personalizationNode', personalizationNode)
  .addNode('composerNode', composerNode)
  // Entry point
  .addEdge(START, 'plannerNode')
  // Fan-out from plannerNode to all 5 tool/retrieval nodes
  .addEdge('plannerNode', 'weatherNode')
  .addEdge('plannerNode', 'attractionsNode')
  .addEdge('plannerNode', 'accommodationNode')
  .addEdge('plannerNode', 'budgetNode')
  .addEdge('plannerNode', 'personalizationNode')
  // Fan-in from all 5 nodes into composerNode
  .addEdge('weatherNode', 'composerNode')
  .addEdge('attractionsNode', 'composerNode')
  .addEdge('accommodationNode', 'composerNode')
  .addEdge('budgetNode', 'composerNode')
  .addEdge('personalizationNode', 'composerNode')
  // composerNode completes at END
  .addEdge('composerNode', END);

// Compile and export the graph
export const graph = workflow.compile();
export default graph;
