import React from 'react'
import ReactDOM from 'react-dom';
import { AnonimizeStateState } from '../types/AnonimizeState'
import { Entity } from '../types/Entity'
import { AddEntityDryRun, EntityPool } from '../types/EntityPool'
import { EntityTypeI, getEntityType, getEntityTypes } from '../types/EntityTypes'
import { TokenSelection } from '../types/Selection'
import { VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';


export interface AnonimizeContentProps {
    doc: HTMLElement
    pool: EntityPool
    ents: Entity[]
    anonimizeState: AnonimizeStateState
    showTypes: boolean
    listSize: number[]
    listRef: React.RefObject<VariableSizeList>
    offsetIndex: {[key: number]: number}
}

export interface AnonimizeContentState {
    selection: TokenSelection | undefined
    selectionWould: AddEntityDryRun | undefined
    selectionAffects: number,
    sizer: boolean
}

export default class AnonimizeContent extends React.Component<AnonimizeContentProps,AnonimizeContentState>{
    contentRef: React.RefObject<HTMLDivElement> = React.createRef();
    nodes: HTMLElement[] = []
    state: AnonimizeContentState = {
        selection: undefined,
        selectionWould: undefined,
        selectionAffects: 0,
        sizer: true
    }

    updateSelection = (ev: MouseEvent) => {
        let sel = window.getSelection();
        if( !sel || sel.isCollapsed ){
            sel = null
        }
        else{
            let commonAncestorContainer = sel.getRangeAt(0).commonAncestorContainer;
            if( !commonAncestorContainer.contains(this.contentRef.current) && !this.contentRef.current?.contains(commonAncestorContainer) ){
                sel = null
            }
        }
        if( sel !== null ){
            let range = sel.getRangeAt(0);
            let startOffset = parseInt(range.startContainer.parentElement?.dataset.offset || "-1");
            let endOffset = parseInt(range.endContainer.parentElement?.dataset.offset || "-1") + (range.endContainer.parentElement?.textContent?.length || 0);
            if( range.startContainer.textContent?.length == range.startOffset ){
                startOffset+=range.startOffset;
                console.log("FIXING OFF BY ONE ERROR (start)");
            }
            if( range.endOffset == 0 ){
                console.log("FIXING OFF BY ONE ERROR (end)");
                endOffset-=1;
            }
            if( startOffset >= 0 && endOffset >= 0){
                let cnodes = this.nodes.filter((e: HTMLElement) => parseInt(e.dataset.offset || "-1") >= startOffset && parseInt(e.dataset.offset || "-1") < endOffset )
                let sNode = cnodes[0]?.firstChild;
                let eNode = cnodes[cnodes.length-1]?.lastChild;
                if( sNode && eNode ){
                    range.setStart(sNode,0);
                    range.setEnd(eNode, eNode.textContent?.length || 0 );
                }
                let text = cnodes.map(e => e.textContent).join("")
                let r = this.props.pool.addEntityDryRun(startOffset, endOffset-1, text)
                this.setState({
                    selection: {
                        text: text,
                        start: startOffset,
                        end: endOffset-1
                    },
                    selectionWould: r[0],
                    selectionAffects: r[1]
                });
                return;
            }
            else{
                sel = null;
            }
        }
        if( this.state.selection !== undefined ){
            this.setState({selection: undefined})
        }
        else{
            let target = ev.target;
            if( target instanceof HTMLElement ){
                let startOffset = parseInt(target.dataset.offset || "-1");
                let iresult = this.props.pool.entitiesAt(startOffset, startOffset+1);
                let ent = iresult[0];
                if( ent ){
                    let off = ent.offsets.find( off => startOffset >= off.start && startOffset < off.end );
                    if( off ){
                        this.setState({
                            selection: {
                                text: this.props.pool.originalText.substring(off.start, off.end+1),
                                start: off.start,
                                end: off.end
                            },
                            selectionWould: AddEntityDryRun.CHANGE_TYPE,
                            selectionAffects: 1
                        })
                    }
                }
            }
        }
    }

    componentDidMount(): void {
        window.addEventListener("mouseup", this.updateSelection)
        this.nodes = Array.from(this.contentRef.current?.querySelectorAll(`[data-offset]`) as NodeListOf<HTMLElement>)

        setTimeout(function() : void {
        }.bind(this), 1000)
        
        if (this.state.sizer == true) this.setState({sizer:false})
    }
    componentWillUnmount(): void {
        window.removeEventListener("mouseup", this.updateSelection)
    }

    render(): React.ReactNode {
        let listItems: JSX.Element[] = [];
        let offset = 0;

        for(let i=0; i < this.props.doc.childNodes.length; i++){
            listItems.push(<AnonimizeBlock key={i} listIdx={i} sizer={this.state.sizer} element={this.props.doc.childNodes[i]} offset={offset} ents={this.props.ents} anonimizeState={this.props.anonimizeState} listSize={this.props.listSize}/>)
            this.props.offsetIndex[offset] = i;
            offset += (this.props.doc.childNodes[i].textContent?.normalize("NFKC") || "").length;
        }

        const getSize =  (index: number): number => {
            return this.props.listSize[index] || 20;
        }
        
        const list = ({ height }: { height: number }) => (
            <AutoSizer disableHeight>
                {({ width }) => (
                    <VariableSizeList 
                    height={height}
                    width={width}
                    itemCount={listItems.length}
                    itemSize={getSize}
                    ref={this.props.listRef}
                    >
                    {({ index, style }) => (
                        <div style={{...style}} id={"List Block Number: " + index}>
                            {listItems[index]}
                        </div>
                    )}
                    </VariableSizeList >
                )}
            </AutoSizer>
        );
     
        if (this.state.sizer == true || this.props.anonimizeState != AnonimizeStateState.TAGGED) {
            return <>
                <div id="content" className={this.props.showTypes ? 'show-type' : 'show-cod'} ref={this.contentRef}>
                    {listItems}
                </div>
                <AnonimizeTooltip 
                    pool={this.props.pool}
                    selection={this.state.selection}
                    selectionWould={this.state.selectionWould}
                    selectionAffects={this.state.selectionAffects}
                />
            </>
        }
        else {
            return <>
                <div id="content" className={this.props.showTypes ? 'show-type' : 'show-cod'} ref={this.contentRef}>
                    {list({ height: window.innerHeight})}
                </div>
                <AnonimizeTooltip 
                    pool={this.props.pool}
                    selection={this.state.selection}
                    selectionWould={this.state.selectionWould}
                    selectionAffects={this.state.selectionAffects}
            />
        </>
        }
    }
}

interface AnonimizeBlockProps{
    element: ChildNode
    offset: number
    ents: Entity[],
    anonimizeState: AnonimizeStateState
    listSize: number[]
    listIdx: number
    sizer: boolean
}

class AnonimizeBlock extends React.Component<AnonimizeBlockProps>{
    blockRef: React.RefObject<HTMLDivElement> = React.createRef();

    componentDidMount() {
        if (this.props.listIdx == -1) return
        if (this.props.sizer == true) {
            const height = this.blockRef.current?.offsetHeight || 0
            let extra = height * 0.2
            if (extra > 50) extra = 50
            this.props.listSize[this.props.listIdx] = height + extra
        }
    }

    render(): React.ReactNode {
        let elmt = this.props.element;

        if( elmt.nodeType === Node.TEXT_NODE ){
            let elmtStr = elmt.nodeValue?.normalize("NFKC") || ""; // should never be null tho...
            let tokensElems = [];
            var reg = /([0-9]+)|([A-Za-zÀ-ÖØ-öø-ÿ]+)|([^A-Za-zÀ-ÖØ-öø-ÿ0-9])/g;
            var token;
            while((token = reg.exec(elmtStr)) !== null) {
                
                tokensElems.push(<AnonimizeToken key={token.index} string={token[0]} offset={this.props.offset+token.index} ents={this.props.ents} anonimizeState={this.props.anonimizeState} />);
            }
            return (
                tokensElems
            )
        }

        let Tag = elmt.nodeName.toLowerCase();
        let elmtElmt: HTMLElement = elmt as HTMLElement;

        let r = [];
        let suboffset = 0;
        for(let i = 0; i < elmt.childNodes.length; i++){
            r.push(<AnonimizeBlock key={i} sizer={this.props.sizer} listIdx={-1} element={elmt.childNodes[i]} offset={this.props.offset + suboffset} ents={this.props.ents} anonimizeState={this.props.anonimizeState} listSize={this.props.listSize} />)
            suboffset += (elmt.childNodes[i].textContent?.normalize("NFKC") || "").length
        }
        
        let attrs: any  = {};
        attrs['ref'] = this.blockRef;
        for(let attr of elmtElmt.getAttributeNames()){
            attrs[attr] = elmtElmt.getAttribute(attr);
        }
        if( 'style' in attrs ){
            let s = attrs['style'];
            delete attrs['style'];
            attrs['STYLE'] = s; // style should be a JS objecy, STYLE gives warning but its not intercepted
        }
        
        if( 'class' in attrs ){
            let c = attrs['class'];
            delete attrs['class'];
            attrs['className'] = c;
        }

        if( Tag === 'a' && attrs['href'] && !attrs['href'].startsWith('#')){
            attrs['target'] = '_blank'; // prevent user to exit page
        }

        if( r.length === 0 ){
            return React.createElement(Tag, attrs);
        }
        else{
            return React.createElement(Tag, attrs, r);
        }
    }
}

type AnonimizeTokenProps = {
    string: string
    offset: number
    ents: Entity[]
    anonimizeState: AnonimizeStateState
}

class AnonimizeToken extends React.Component<AnonimizeTokenProps>{
    render(): React.ReactNode {
        // Token Anonimized
        let isPartAnonimize = null; 
        let isPartAnonimizeOffset = null;
        for( let ent of this.props.ents ){
            for(let offset of ent.offsets){
                if(offset.start <= this.props.offset && this.props.offset + this.props.string.length-1 <= offset.end){
                    isPartAnonimizeOffset = offset;
                    isPartAnonimize = ent;
                    break;
                }
                if( offset.start > this.props.offset ) break;
            }
            if( isPartAnonimize ){
                break
            }
        }

        let dataAttrs: {[_:string]: string} = {
            'data-offset': this.props.offset.toString()
        };

        
        if( isPartAnonimize && isPartAnonimizeOffset ){
            let type: EntityTypeI = getEntityType(isPartAnonimize.type);
            dataAttrs['data-anonimize-cod'] = isPartAnonimize.anonimizingFunction()(isPartAnonimize.offsets[0].preview, isPartAnonimize.type, isPartAnonimize.index, isPartAnonimize.typeIndex, isPartAnonimize.funcIndex);
            dataAttrs['data-anonimize-type'] = type.name;
            dataAttrs['data-anonimize-color'] = type.color;
            dataAttrs['data-anonimize-offset-start'] = isPartAnonimizeOffset.start.toString()
            dataAttrs['data-anonimize-offset-end'] = isPartAnonimizeOffset.end.toString()
            if( isPartAnonimizeOffset.start === this.props.offset ){
                dataAttrs['data-anonimize-first'] = "true";
            }
            if(  this.props.offset === isPartAnonimizeOffset.end-this.props.string.length+1 ){
                dataAttrs['data-anonimize-last'] = "true";
            }
        }

        switch(this.props.anonimizeState){
            case AnonimizeStateState.ANONIMIZED:
                if( isPartAnonimize && 'data-anonimize-first' in dataAttrs ){
                    return dataAttrs['data-anonimize-cod'];
                }
                else if( isPartAnonimize ){
                    return ""
                }
                else{
                    return this.props.string
                }
            case AnonimizeStateState.ORIGINAL:
                return this.props.string;
            case AnonimizeStateState.TAGGED:
                return <span {...dataAttrs}>{this.props.string}</span>;
            default:
                return "";
        }
    }
}

interface AnonimizeTooltipProps {
    selectionWould: AddEntityDryRun | undefined
    selectionAffects: number
    selection: TokenSelection | undefined
    pool: EntityPool
}

// <AnonimizeTooltip>
class AnonimizeTooltip extends React.Component<AnonimizeTooltipProps>{
    
    onClickType = (type: EntityTypeI, selection: TokenSelection) => {
        this.props.pool.removeOffset(selection.start, selection.end);
        this.props.pool.addEntity(selection.start, selection.end, selection.text, type.name);
    }

    onClickRemove = (selection: TokenSelection) => {
        this.props.pool.removeOffset(selection.start, selection.end)
    }

    render(): React.ReactNode {
        if( !this.props.selection ){
            return "";
        } 
        let sel = this.props.selection;
        let start = document.querySelector(`[data-offset="${sel.start}"]`);
        if(!start) return;
        let rects = start.getClientRects();

        let style: React.CSSProperties = {
            position: "fixed",
            display: "block",
            bottom: window.innerHeight - rects[0].top,
            top: rects[0].top+rects[0].height,
            left: rects[0].left,
            width: "fit-content"
        };

        if( rects[0].top > window.innerHeight / 2 ){
            delete style.top;
        }
        else{
            delete style.bottom;
        }

        switch(this.props.selectionWould){
            case AddEntityDryRun.CHANGE_ARRAY:
                return <div style={style}>
                    <div className="d-flex flex-column gap-1 bg-white p-1 border">
                        {getEntityTypes().map( (t,i) => <span key={i} role="button" className='badge text-body' style={{background: t.color}} onMouseDown={this.onClickType.bind(this, t, sel)}>{t.name}</span>)}
                    </div>
                </div>;
            case AddEntityDryRun.CHANGE_OFFSET:
                return <div style={style}>
                    <div className="d-flex flex-column gap-1 bg-white p-1 border">
                        {getEntityTypes().map( (t,i) => <span key={i} role="button" className='badge text-body' style={{background: t.color}} onMouseDown={this.onClickType.bind(this, t, sel)}>{t.name}</span>)}
                    </div>
                </div>;
            case AddEntityDryRun.CHANGE_TYPE:
                return <div style={style}>
                    <div className="d-flex flex-column gap-1 bg-white p-1 border">
                        <span role="button" onMouseDown={this.onClickRemove.bind(this, sel)}><i className='bi bi-trash'></i> Remover</span>
                        {getEntityTypes().map( (t,i) => <span key={i} role="button" className='badge text-body' style={{background: t.color}} onMouseDown={this.onClickType.bind(this, t, sel)}>{t.name}</span>)}
                    </div>
                </div>;

        }
    }
}