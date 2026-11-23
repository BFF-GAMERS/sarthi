import { Component, type ReactNode, type RefObject } from "react";

interface FocusKeeperProps {
  /** Changes whenever the stage's children are re-ordered, added or removed. */
  signature: string;
  /** The element whose descendants' focus should survive the re-order. */
  containerRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Keeps keyboard focus (and an input's caret) alive across a re-order.
 *
 * When React re-orders keyed children it moves their DOM nodes, and a browser
 * drops focus from a node that is moved. For an interface that rearranges
 * itself while somebody is typing in a search box, that is the worst possible
 * failure: the keystrokes simply stop landing. "Input never lost" is a
 * requirement of the brief, so this puts focus back.
 *
 * It has to be a class component: `getSnapshotBeforeUpdate` is the only hook
 * that runs after render but *before* the DOM is touched, which is the one
 * moment `document.activeElement` still points at the right node. It renders
 * nothing of its own and only runs in the browser, after an update, so it is
 * invisible to server rendering.
 *
 * `preventScroll` matters: restoring focus must never move the page.
 */
export class FocusKeeper extends Component<FocusKeeperProps, unknown, HTMLElement | null> {
  override getSnapshotBeforeUpdate(prev: FocusKeeperProps): HTMLElement | null {
    if (prev.signature === this.props.signature) return null;
    const box = this.props.containerRef.current;
    const active = document.activeElement;
    if (box && active instanceof HTMLElement && active !== box && box.contains(active)) {
      return active;
    }
    return null;
  }

  override componentDidUpdate(
    _prev: FocusKeeperProps,
    _state: unknown,
    snapshot: HTMLElement | null,
  ) {
    if (snapshot && snapshot.isConnected && document.activeElement !== snapshot) {
      snapshot.focus({ preventScroll: true });
    }
  }

  override render() {
    return this.props.children;
  }
}
