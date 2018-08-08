"use strict";

const { ipcMain } = require("electron");
const logger = require("../logwrapper");
const EventEmitter = require("events");
const util = require("../utility");
const eventsRouter = require("./events-router");

class EventManager extends EventEmitter {
  constructor() {
    super();

    this._registeredEventSources = [];
  }

  registerEventSource(eventSource) {
    // TODO: validate eventSource

    //make sure all events reference this eventsource id
    if (eventSource.events != null) {
      for (let event of eventSource.events) {
        event.sourceId = eventSource.id;
      }
    }

    this._registeredEventSources.push(eventSource);

    logger.debug(`Registered Event Source ${eventSource.id}`);

    this.emit("eventSourceRegistered", eventSource);
  }

  getEventSourceById(sourceId) {
    return this._registeredEventSources.find(es => es.id === sourceId);
  }

  getEventById(sourceId, eventId) {
    let source = this._registeredEventSources.find(es => es.id === sourceId);
    let event = source.events.find(e => e.id === eventId);
    return event;
  }

  getAllEventSources() {
    return this._registeredEventSources;
  }

  getAllEvents() {
    let eventArrays = this._registeredEventSources.map(es => es.events);
    let events = util.flattenArray(eventArrays);
    return events;
  }

  triggerEvent(sourceId, eventId, meta, isManual = false) {
    let source = this.getEventSourceById(sourceId);
    let event = this.getEventById(sourceId, eventId);
    if (event == null) return;

    if (isManual) {
      meta = event.manualMetadata;
    }

    //todo: support filter checking
    eventsRouter.onEventTriggered(event, source, meta, isManual);
  }
}

const manager = new EventManager();

ipcMain.on("getAllEventSources", event => {
  logger.info("got 'get all event sources' request");
  event.returnValue = manager.getAllEventSources();
});

ipcMain.on("getAllEvents", event => {
  logger.info("got 'get all events' request");
  event.returnValue = manager.getAllEvents();
});

// Manually Activate an Event for Testing
// This will manually trigger an event for testing purposes.
ipcMain.on("triggerManualEvent", function(event, data) {
  manager.triggerEvent(data.sourceId, data.eventId, null, true);
});

module.exports = manager;