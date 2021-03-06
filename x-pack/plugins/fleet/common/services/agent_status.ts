/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { AGENT_POLLING_THRESHOLD_MS, AGENT_SAVED_OBJECT_TYPE } from '../constants';
import type { Agent, AgentStatus } from '../types';

export function getAgentStatus(agent: Agent, now: number = Date.now()): AgentStatus {
  const { last_checkin: lastCheckIn } = agent;

  if (!agent.active) {
    return 'inactive';
  }
  if (agent.unenrollment_started_at && !agent.unenrolled_at) {
    return 'unenrolling';
  }
  if (!agent.last_checkin) {
    return 'enrolling';
  }

  const msLastCheckIn = new Date(lastCheckIn || 0).getTime();
  const msSinceLastCheckIn = new Date().getTime() - msLastCheckIn;
  const intervalsSinceLastCheckIn = Math.floor(msSinceLastCheckIn / AGENT_POLLING_THRESHOLD_MS);

  if (agent.last_checkin_status === 'error') {
    return 'error';
  }
  if (agent.last_checkin_status === 'degraded') {
    return 'degraded';
  }
  if (agent.upgrade_started_at && !agent.upgraded_at) {
    return 'updating';
  }
  if (intervalsSinceLastCheckIn >= 4) {
    return 'offline';
  }

  return 'online';
}

export function buildKueryForEnrollingAgents() {
  return `not (${AGENT_SAVED_OBJECT_TYPE}.last_checkin:*)`;
}

export function buildKueryForUnenrollingAgents() {
  return `${AGENT_SAVED_OBJECT_TYPE}.unenrollment_started_at:*`;
}

export function buildKueryForOnlineAgents() {
  return `not (${buildKueryForOfflineAgents()}) AND not (${buildKueryForErrorAgents()}) AND not (${buildKueryForUpdatingAgents()})`;
}

export function buildKueryForErrorAgents() {
  return `${AGENT_SAVED_OBJECT_TYPE}.last_checkin_status:error or ${AGENT_SAVED_OBJECT_TYPE}.last_checkin_status:degraded`;
}

export function buildKueryForOfflineAgents() {
  return `${AGENT_SAVED_OBJECT_TYPE}.last_checkin < now-${
    (4 * AGENT_POLLING_THRESHOLD_MS) / 1000
  }s AND not (${buildKueryForErrorAgents()}) AND not ( ${buildKueryForUpdatingAgents()} )`;
}

export function buildKueryForUpgradingAgents() {
  return `(${AGENT_SAVED_OBJECT_TYPE}.upgrade_started_at:*) and not (${AGENT_SAVED_OBJECT_TYPE}.upgraded_at:*)`;
}

export function buildKueryForUpdatingAgents() {
  return `(${buildKueryForUpgradingAgents()}) or (${buildKueryForEnrollingAgents()}) or (${buildKueryForUnenrollingAgents()})`;
}

export function buildKueryForInactiveAgents() {
  return `${AGENT_SAVED_OBJECT_TYPE}.active:false`;
}
