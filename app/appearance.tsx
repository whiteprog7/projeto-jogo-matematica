'use client';
import {createContext,useContext} from 'react';
import {outfits} from '@/lib/content';
const AppearanceContext=createContext(0);
export function TufiAppearance({outfit,children}:{outfit:number;children:React.ReactNode}){
 return <AppearanceContext.Provider value={outfits[outfit]?outfit:0}>{children}</AppearanceContext.Provider>;
}
export function useTufiOutfit(){return outfits[useContext(AppearanceContext)]||outfits[0]}
