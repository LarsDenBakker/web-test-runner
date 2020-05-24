interface ItemWithId<I> {
  id: I;
}

export function arrayReplaceOrAddById<I, V extends ItemWithId<I>>(
  array: V[],
  replacedItem: V
): V[] {
  return array.filter((i) => i.id !== replacedItem.id).concat(replacedItem);
}

export function replaceOrAddInMappedArray<K, I, V extends ItemWithId<I>>(
  map: Map<K, V[]>,
  key: K,
  replacedItem: V
) {
  let array = map.get(key);
  if (!array) {
    array = [replacedItem];
  } else {
    array = arrayReplaceOrAddById(array, replacedItem);
  }
  map.set(key, array);
}

export function removeFromMappedArray<K, I, V extends ItemWithId<I>>(
  map: Map<K, V[]>,
  key: K,
  replacedItem: V
) {
  let array = map.get(key);
  if (array) {
    array = array.filter((i) => i.id !== replacedItem.id);
    map.set(key, array);
  }
}
