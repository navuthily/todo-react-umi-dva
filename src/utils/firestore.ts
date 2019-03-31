import { EffectsMapObject, Model, ReducersMapObjectWithEnhancer, SubscriptionsMapObject } from 'dva';
import { ReducersMapObject } from 'redux';
import firebase from 'firebase';
import Query = firebase.firestore.Query;
import FieldPath = firebase.firestore.FieldPath;
import WhereFilterOp = firebase.firestore.WhereFilterOp;
import Firestore = firebase.firestore.Firestore;
import pathToRegexp from 'path-to-regexp'

export interface FirestoreCollectionState<T> {
  list: T[],
}

export interface FirestoreWhere {
  fieldPath: string | FieldPath,
  opStr: WhereFilterOp,
  value: any,
}

export class FirestoreCollectionModel<T, S extends FirestoreCollectionState<T>> implements Model {
  namespace: string;
  state: S;
  effects: EffectsMapObject;
  reducers: ReducersMapObject | ReducersMapObjectWithEnhancer;
  subscriptions: SubscriptionsMapObject;

  constructor(collection : string, initialState : S, firestore : Firestore, wheres? : FirestoreWhere[]) {
    this.namespace = collection;
    this.state = initialState;
    this.effects = {
      *push({payload}, {call}) {
        yield call(() => {
          firestore.collection(collection).add(payload);
        });
      },
      *update({id, payload}, {call}) {
        yield call(() => {
          firestore.collection(collection).doc(id).update(payload);
        })
      },
      *delete({id}, {call}) {
        yield call(() => {
          firestore.collection(collection).doc(id).delete();
        })
      },
      *toArray({ payload }, { put }) {
        const list : T[] = [];
        payload.snapshot.forEach(doc => {
          list.push({
            ...doc.data() as T,
            id: doc.id,
          })
        });
        yield put({
          type: 'all',
          payload: list,
        });
      }
    };

    this.reducers = {
      all(state : T, { type, payload }) {
        return {
          ...state,
          list: payload
        }
      },
    };

    this.subscriptions = {
      setup({history, dispatch}, done) {
        let unsubscribe : Function;
        history.listen(({pathname}) => {
          const match = pathToRegexp('/' + collection).exec(pathname)
          if (match && !unsubscribe ) {
            var ref = firestore.collection(collection) as Query;
            if (wheres) {
              wheres.forEach(w => {
                ref = ref.where(w.fieldPath, w.opStr, w.value);
              });
            }

            unsubscribe = ref.onSnapshot(snapshot => {
                dispatch({
                  type: 'toArray',
                  payload: { snapshot: snapshot },
                })
              })
          } else if (!match && unsubscribe) {
            unsubscribe();
            unsubscribe = null;
          }
        });
      }
    };
  }
};
