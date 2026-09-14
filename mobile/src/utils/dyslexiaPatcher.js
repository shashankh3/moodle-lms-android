import React from 'react';
import { Text, TextInput, Platform, StyleSheet } from 'react-native';

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

function containsDevanagari(children) {
  if (typeof children === 'string') {
    return DEVANAGARI_REGEX.test(children);
  }
  if (Array.isArray(children)) {
    return children.some(c => containsDevanagari(c));
  }
  if (children && typeof children === 'object' && children.props) {
    return containsDevanagari(children.props.children);
  }
  return false;
}

export const globalDyslexiaState = {
  enabled: false,
  fontSizeMultiplier: 1.0,
  language: 'en',
  listeners: new Set(),
};

export function setDyslexiaEnabled(enabled, fontSizeMultiplier = 1.0, language = 'en') {
  globalDyslexiaState.enabled = !!enabled;
  globalDyslexiaState.fontSizeMultiplier = fontSizeMultiplier || 1.0;
  globalDyslexiaState.language = language || 'en';

  // Notify all listeners to force a full re-render across all screens
  globalDyslexiaState.listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {}
  });
}

export function subscribeDyslexiaState(listener) {
  globalDyslexiaState.listeners.add(listener);
  return () => {
    globalDyslexiaState.listeners.delete(listener);
  };
}

let isPatched = false;

function applyDyslexiaStyle(originalStyle, props) {
  if (!globalDyslexiaState.enabled && globalDyslexiaState.fontSizeMultiplier === 1.0) {
    return originalStyle;
  }

  const flattened = StyleSheet.flatten(originalStyle) || {};
  const isBold =
    flattened.fontWeight === 'bold' ||
    flattened.fontWeight === '700' ||
    flattened.fontWeight === '800' ||
    flattened.fontWeight === '900' ||
    flattened.fontWeight === '600';

  const override = {};

  if (globalDyslexiaState.enabled) {
    const isDevanagari =
      containsDevanagari(props?.children) ||
      globalDyslexiaState.language === 'hi' ||
      globalDyslexiaState.language === 'mr';

    if (isDevanagari) {
      override.fontFamily = isBold ? 'Kalam-Bold' : 'Kalam';
    } else {
      override.fontFamily = isBold ? 'OpenDyslexic-Bold' : 'OpenDyslexic';
    }
    override.letterSpacing = isDevanagari ? 0.2 : 0.35;
  }

  if (globalDyslexiaState.fontSizeMultiplier !== 1.0) {
    const baseSize = flattened.fontSize || 14;
    override.fontSize = Math.round(baseSize * globalDyslexiaState.fontSizeMultiplier);
  }

  return [originalStyle, override];
}

export function initGlobalDyslexiaPatcher() {
  if (isPatched) return;
  isPatched = true;

  // 1. Patch React.createElement
  const originalCreateElement = React.createElement;
  React.createElement = function (type, props, ...children) {
    if (
      type === Text ||
      type === TextInput ||
      (type &&
        (type.displayName === 'Text' ||
          type.name === 'TextImpl' ||
          type.name === 'Text' ||
          type.name === 'TextInput'))
    ) {
      if (props && (globalDyslexiaState.enabled || globalDyslexiaState.fontSizeMultiplier !== 1.0)) {
        props = { ...props, style: applyDyslexiaStyle(props.style, props) };
      }
    }
    return originalCreateElement.call(React, type, props, ...children);
  };

  // 2. Patch react/jsx-runtime if available
  try {
    const jsxRuntime = require('react/jsx-runtime');
    if (jsxRuntime && jsxRuntime.jsx) {
      const origJsx = jsxRuntime.jsx;
      const origJsxs = jsxRuntime.jsxs;

      jsxRuntime.jsx = function (type, props, key) {
        if (
          type === Text ||
          type === TextInput ||
          (type &&
            (type.displayName === 'Text' ||
              type.name === 'TextImpl' ||
              type.name === 'Text' ||
              type.name === 'TextInput'))
        ) {
          if (props && (globalDyslexiaState.enabled || globalDyslexiaState.fontSizeMultiplier !== 1.0)) {
            props = { ...props, style: applyDyslexiaStyle(props.style, props) };
          }
        }
        return origJsx(type, props, key);
      };

      if (origJsxs) {
        jsxRuntime.jsxs = function (type, props, key) {
          if (
            type === Text ||
            type === TextInput ||
            (type &&
              (type.displayName === 'Text' ||
                type.name === 'TextImpl' ||
                type.name === 'Text' ||
                type.name === 'TextInput'))
          ) {
            if (props && (globalDyslexiaState.enabled || globalDyslexiaState.fontSizeMultiplier !== 1.0)) {
              props = { ...props, style: applyDyslexiaStyle(props.style, props) };
            }
          }
          return origJsxs(type, props, key);
        };
      }
    }
  } catch (e) {}

  // 3. Patch react/jsx-dev-runtime if available (used in Expo / Metro development)
  try {
    const jsxDevRuntime = require('react/jsx-dev-runtime');
    if (jsxDevRuntime && jsxDevRuntime.jsxDEV) {
      const origJsxDEV = jsxDevRuntime.jsxDEV;
      jsxDevRuntime.jsxDEV = function (type, props, key, isStaticChildren, source, self) {
        if (
          type === Text ||
          type === TextInput ||
          (type &&
            (type.displayName === 'Text' ||
              type.name === 'TextImpl' ||
              type.name === 'Text' ||
              type.name === 'TextInput'))
        ) {
          if (props && (globalDyslexiaState.enabled || globalDyslexiaState.fontSizeMultiplier !== 1.0)) {
            props = { ...props, style: applyDyslexiaStyle(props.style, props) };
          }
        }
        return origJsxDEV(type, props, key, isStaticChildren, source, self);
      };
    }
  } catch (e) {}
}
