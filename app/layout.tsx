import type {Metadata} from 'next';
import './globals.css';
import './garden.css';
import './immersive.css';
import ModalSafety from './components/modal-safety';
import PortalTravel from './components/portal-travel';
import Soundscape from './components/soundscape';
import MomentLibrary from './components/moment-library';
import ImmersiveHud from './components/immersive-hud';
import {Achievements} from './components/achievements';
import GoogleAnalytics from './components/google-analytics';
export const metadata:Metadata={metadataBase:new URL('https://pure-exploration.arnz.chatgpt.site'),title:'Pure Exploration · A universe by Arnav',description:'Walk into a living garden. Follow starlight through a telescope, explore a night airport, and find your next world.',openGraph:{title:'Pure Exploration',description:'Little worlds. Big curiosity. Built by Arnav with Codex.',type:'website',images:[{url:'/covers/garden.jpg',width:1280,height:720,alt:'The futuristic garden at Pure Exploration'}]},twitter:{card:'summary_large_image',title:'Pure Exploration · A universe by Arnav',description:'Pick a door. Follow a feeling.',images:['/covers/garden.jpg']},icons:{icon:'/icon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<ModalSafety/><PortalTravel/><GoogleAnalytics/><MomentLibrary/><Soundscape/><Achievements/><ImmersiveHud/></body></html>;}
