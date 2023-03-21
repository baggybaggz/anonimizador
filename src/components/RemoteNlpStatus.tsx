import React from "react";
import { Entity, normalizeEntityString } from "../types/Entity";
import { EntityPool } from "../types/EntityPool";
import { Button } from "../util/BootstrapIcons";

interface RemoteEntity {
    text: string,
    label_: string,
    start_char: number,
    end_char: number
}

interface RemoteNlpStatusProps {
    doc: HTMLElement
    pool: EntityPool
    disabled: boolean
}

interface RemoteNlpStatusState {
    requested: boolean
    text: string
}

export default class RemoteNlpStatus extends React.Component<RemoteNlpStatusProps, RemoteNlpStatusState>{
    state: RemoteNlpStatusState = {
        requested: false,
        text: "Sugerir"
    }
    
    runRemoteNlp = async () => {
        if( this.state.requested ) return;
        this.setState({
            requested: true,
            text: "Aguarde"
        })
        let text = Array.from(this.props.doc.children).map(h => h.textContent).join("\n").normalize("NFKC")

        let fd = new FormData()
        fd.append("file", new Blob([text]), "input.json")

        let resArray: RemoteEntity[] = await fetch("./from-text", {
            method: "POST",
            body: fd
        }).then( r => {
            if( r.status === 200 )
                return r.json();
            alert( `Servidor respondeu: ${r.status} (${r.statusText})` )
            return [];
        }).catch( e => {
            alert( e );
            return [];
        })
        let errorOffset = 0;
        let entities: {[key: string]: Entity} = {};
        for( let ent of resArray ){
            let id = normalizeEntityString(ent.text) + ent.label_
            if( !(id in entities) ){
                entities[id] = new Entity(ent.label_);
            }
            let soff = text.substring(0,ent.start_char).match(/\n/g)?.length || 0
            let eoff = text.substring(0,ent.end_char).match(/\n/g)?.length || 0
            if( this.props.pool.originalText.substring(ent.start_char-soff+errorOffset, ent.end_char-eoff+errorOffset) == text.substring(ent.start_char, ent.end_char) ){
                entities[id].addOffset([{start: ent.start_char-soff+errorOffset, end: ent.end_char-1-eoff+errorOffset, preview: ent.text}]) // Spacy has an endchar outside of entity
            }
            else{
                let m = this.props.pool.originalText.substring(ent.start_char-soff+errorOffset).match(ent.text);
                if( m ){
                    errorOffset+=m.index || 0;
                }
                if( this.props.pool.originalText.substring(ent.start_char-soff+errorOffset, ent.end_char-eoff+errorOffset) == text.substring(ent.start_char, ent.end_char) ){
                    entities[id].addOffset([{start: ent.start_char-soff+errorOffset, end: ent.end_char-1-eoff+errorOffset, preview: ent.text}]) // Spacy has an endchar outside of entity
                }
                else{
                    console.log(this.props.pool.originalText.substring(ent.start_char-soff+errorOffset, ent.end_char-eoff+errorOffset), text.substring(ent.start_char, ent.end_char), ent, soff, eoff);
                }
            }
        }

        this.props.pool.entities = Object.values(entities).sort((a, b) => a.offsets[0].start-b.offsets[0].start)
        this.props.pool.updateOrder();
        this.setState({
            requested: false,
            text: "Sugerir"
        });
    }

    render(): React.ReactNode {
        return <Button className="red-link fw-bold btn" onClick={this.runRemoteNlp} disabled={this.props.pool.entities.length > 0 || this.state.requested || this.props.disabled} i="file-earmark-break" title={this.state.text} />
    }
}