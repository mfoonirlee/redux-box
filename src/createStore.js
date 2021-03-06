import createSagaMiddleware from 'redux-saga';
import { all } from 'redux-saga/effects';
import {
  applyMiddleware,
  combineReducers,
  createStore as storeCreator,
} from 'redux';
import get from './utils/get';
import composeEnhancers from './composeEnhancers';
import moduleRegistry from './moduleRegistry';
import getReducer from './getReducer';

/**
 * @typedef {Object} Module - Object representing module
 * @property {Object=} state - Initial state for the module
 * @property {Object<String, Function>=} dispatchers - Action dispatchers for the module
 * @property {Object<String, Generator>=} sagas - Sagas for the module
 * @property {Object<String, Function>=} mutations - Mutations for the module
 * @property {Object<String, Function>=} selectors - Selector for the module
 */

/**
 * Creates redux store
 * @example
 * import { createStore } from "redux-box";
 * import userModule from "./modules/user";
 * import marketplaceModule from "./modules/marketplace";
 *
 * createStore({userModule, marketplaceModule},{
 *  enableDevTools: () => true,
 *  devToolOptions: {}
 * })
 *
 * @param {Object<String, Module>} modules - Object containing all modules to be attached to store
 * @param {Function=} config.enableDevTools - (Optional)enable devtool conditionally
 * @param {Object} config -  Contains configuration for store
 * @param {Function[]} config.middlewares - Array of middlewares to be used in store
 * @param {Object<String, Function>=} config.reducers - (Optional) Object containing reducers to be used in store
 * @param {Generator[]} config.sagas - Array of watcher sagas to be used in store
 * @param {Object=} config.preloadedState - (Optional) Preloaded state for store
 * @param {Object=} config.devToolOptions - (Optional) options for redux dev tool
 * @param {Function=} config.decorateReducer - (Optional) decorator function for reducer formed by redux-box, has formed reducer as first argument
 * @returns {Object} store
 */
function createStore(modules, config = {}) {
  //  Array containing names of all registered modules
  const moduleNames = Object.keys(modules);

  // Initialize the middleware array
  const sagaMiddleware = createSagaMiddleware();
  let middlewares = [sagaMiddleware];

  // push the provided middlewares in config object, to the middleware array
  if (get(config, 'middlewares.length', 0) > 0) {
    middlewares = middlewares.concat(config.middlewares);
  }

  // an object containing reducers for all modules, to  be fed to combineReducer
  const reducerList = Object.assign({}, config.reducers);
  let sagas = [];

  // iterate through each module and push the sagas and reducers of each module in thier respective array
  moduleNames.forEach(moduleName => {
    const module = modules[moduleName];
    moduleRegistry.register(moduleName, module);
    sagas = sagas.concat(module.sagas);
    let moduleReducer = getReducer(module.mutations, module.state);

    if (module.decorateReducer)
      moduleReducer = module.decorateReducer(moduleReducer);
    reducerList[moduleName] = moduleReducer;
  });

  sagas = config.sagas ? sagas.concat(config.sagas) : sagas;

  let combinedReducer = combineReducers(reducerList);
  if (config.decorateReducer) {
    combinedReducer = config.decorateReducer(combinedReducer);
  }
  const preloadedState = config.preloadedState || {};
  const composer = composeEnhancers(config);
  // initialize the store using preloaded state, reducers and middlewares
  const store = storeCreator(
    combinedReducer,
    preloadedState,
    composer(applyMiddleware(...middlewares))
  );

  // rootsaga
  function* rootSaga() {
    try {
      yield all(sagas);
    } catch (err) {
      console.error('[ERROR] Something went wrong in rootSaga: ', err);
    }
  }

  sagaMiddleware.run(rootSaga);
  return store;
}

export default createStore;
