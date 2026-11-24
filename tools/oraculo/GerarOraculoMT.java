/*
 * Oráculo de testes do núcleo de Máquinas de Turing (MT) do Autômatos Studio.
 *
 * Roda o YAAS ORIGINAL (Prof. Dr. David Buzatto, GPL v3) em cada exemplo de
 * MT e grava os resultados em src/core/tm/__fixtures__/oraculo.json. Os
 * testes em TypeScript (src/core/tm/oraculo.test.ts e examples.test.ts)
 * comparam a nossa implementação com esse arquivo.
 *
 * Como rodar (de dentro de tools/oraculo):
 *
 *   javac -cp ~/Downloads/YAAS-1.0.7.jar -d /tmp/oraculo-mt GerarOraculoMT.java
 *   java -Djava.awt.headless=true -cp ~/Downloads/YAAS-1.0.7.jar:/tmp/oraculo-mt \
 *        GerarOraculoMT ../../src/core/tm/__fixtures__/oraculo.json
 *
 * O que é gravado para cada exemplo:
 *   - acceptance: o modo de aceitação do exemplo (o do menu do YAAS; a MT do
 *     YAAS não guarda o modo);
 *   - type: DTM / NTM segundo o YAAS;
 *   - alphabet: Σ do exemplo (o YAAS não tem Σ: o getAlphabet dele junta
 *     todos os símbolos lidos, inclusive B, X, Y...);
 *   - structure: estados e transições (com a forma da seta), para conferir
 *     que src/core/tm/examples.ts é uma cópia fiel do exemplo;
 *   - accepted: palavras aceitas de tamanho 0 até maxLength sobre Σ;
 *   - outputs (só nas de aceitação por parada): a fita final de cada palavra
 *     aceita (getTapeAfterAcceptsExecution, sem os brancos das pontas);
 *   - yaasTwoOperations: palavras em que o YAAS aplicou, num mesmo passo,
 *     duas operações seguidas da mesma transição (BUG: falta um break no
 *     laço das operações em TM.accepts). Detectado andando pelas IDs do
 *     YAAS: o passo usou uma operação que não existe entre os dois estados;
 *   - yaasStepLimit: palavras em que o YAAS bateu no limite fixo de 4000
 *     passos (TURING_MACHINE_MAX_COUNT) e respondeu "não para";
 *   - yaasEmptyWord: o YAAS lança exceção com a palavra vazia quando a MT lê
 *     o branco no 1º passo (TMID.derive faz "".substring(1)). Nesse caso a
 *     palavra vazia é simulada com a fita "B", que é a mesma configuração.
 *
 * Também grava `bugs`: casos montados para mostrar os 2 bugs da MT do YAAS
 * (a resposta do YAAS em cada um), comparados no oraculo.test.ts.
 */

import br.com.davidbuzatto.yaas.model.tm.TM;
import br.com.davidbuzatto.yaas.model.tm.TMAcceptanceType;
import br.com.davidbuzatto.yaas.model.tm.TMID;
import br.com.davidbuzatto.yaas.model.tm.TMMovementType;
import br.com.davidbuzatto.yaas.model.tm.TMOperation;
import br.com.davidbuzatto.yaas.model.tm.TMState;
import br.com.davidbuzatto.yaas.model.tm.TMTransition;
import br.com.davidbuzatto.yaas.model.tm.examples.TMExamples;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

public class GerarOraculoMT {

    static final int MAX_LENGTH = 6;
    static final long MAX_UNIVERSE = 50_000;
    static final int MAX_EXPLICIT_WORDS = 1_000;

    static final TMAcceptanceType FS = TMAcceptanceType.FINAL_STATE;
    static final TMAcceptanceType HALT = TMAcceptanceType.HALT;

    record Example( String id, String source, Supplier<TM> factory, TMAcceptanceType acceptance, String sigma ) {}

    /** Os ids precisam ser os mesmos de src/core/tm/examples.ts. */
    static final List<Example> EXAMPLES = List.of(
        new Example( "mt-0n1n", "TMExamples.createDTM0n1nFinalState", TMExamples::createDTM0n1nFinalState, FS, "01" ),
        new Example( "mt-monus", "TMExamples.createDTMMonusHalt", TMExamples::createDTMMonusHalt, HALT, "01" ),
        new Example( "mt-laco-infinito", "TMExamples.createDTMInfiniteLoopFinalState", TMExamples::createDTMInfiniteLoopFinalState, FS, "01" ),
        new Example( "mt-sim-ou-nao", "TMExamples.createDTMExample", TMExamples::createDTMExample, FS, "01" ),
        new Example( "mt-mesmo-numero-de-0-e-1", "TMExamples.createDTM01SameFinalState", TMExamples::createDTM01SameFinalState, FS, "01" ),
        new Example( "mt-anbncn", "TMExamples.createDTMAnBnCnFinalState", TMExamples::createDTMAnBnCnFinalState, FS, "abc" ),
        new Example( "mt-divisao", "TMExamples.createDTMDivideHalt", TMExamples::createDTMDivideHalt, HALT, "01" ),
        new Example( "mt-nao-deterministica", "TMExamples.createNTM", TMExamples::createNTM, FS, "01" )
    );

    public static void main( String[] args ) throws Exception {

        Path out = Path.of( args.length > 0 ? args[0] : "oraculo.json" );

        Map<String, Object> root = new LinkedHashMap<>();
        root.put( "generator", "tools/oraculo/GerarOraculoMT.java" );
        root.put( "yaas", "YAAS-1.0.7.jar" );
        root.put( "hash", "sha256 das palavras aceitas de cada tamanho, ordenadas e juntadas com \\n" );

        List<Object> examples = new ArrayList<>();
        for ( Example e : EXAMPLES ) {
            examples.add( processExample( e ) );
            System.out.println( "ok: " + e.id() );
        }
        root.put( "examples", examples );
        root.put( "bugs", bugs() );
        System.out.println( "ok: bugs" );

        StringBuilder sb = new StringBuilder();
        writeJson( root, sb, 0 );
        sb.append( '\n' );
        Files.createDirectories( out.toAbsolutePath().getParent() );
        Files.writeString( out, sb.toString(), StandardCharsets.UTF_8 );
        System.out.println( "gravado: " + out.toAbsolutePath() );

    }

    /** Resultado de uma simulação do YAAS. */
    record Run( boolean accepted, String output, boolean ableToHalt, boolean twoOperations, String emptyWordError ) {}

    static Run run( TM tm, String word, TMAcceptanceType acceptance ) {
        String emptyWordError = null;
        boolean accepted;
        try {
            accepted = tm.accepts( word, acceptance );
        } catch ( RuntimeException exc ) {
            if ( !word.isEmpty() ) {
                throw exc;
            }
            emptyWordError = exc.getClass().getSimpleName();
            accepted = tm.accepts( "B", acceptance );
        }
        return new Run( accepted, tm.getTapeAfterAcceptsExecution(), tm.isAbleToHalt(),
                usedTwoOperations( tm ), emptyWordError );
    }

    /**
     * true se algum passo do YAAS usou uma operação que não existe numa
     * transição entre os dois estados do passo (o efeito do break que falta).
     */
    static boolean usedTwoOperations( TM tm ) {
        TMID node = tm.getRootId();
        while ( node != null && !node.getChildren().isEmpty() ) {
            TMID child = node.getChildren().get( 0 );
            TMOperation o = child.getOperation();
            boolean found = false;
            for ( TMTransition t : tm.getTransitions() ) {
                if ( t.getOriginState() != node.getState() || t.getTargetState() != child.getState() ) {
                    continue;
                }
                for ( TMOperation x : t.getOperations() ) {
                    if ( x.getReadSymbol() == o.getReadSymbol() && x.getWriteSymbol() == o.getWriteSymbol()
                            && x.getType() == o.getType() ) {
                        found = true;
                    }
                }
            }
            if ( !found ) {
                return true;
            }
            node = child;
        }
        return false;
    }

    static Map<String, Object> processExample( Example e ) throws Exception {

        TM tm = e.factory().get();
        tm.updateType();
        List<Character> sigma = new ArrayList<>();
        for ( char c : e.sigma().toCharArray() ) {
            sigma.add( c );
        }
        int maxLength = maxLength( sigma.size() );

        Map<String, Object> r = new LinkedHashMap<>();
        r.put( "id", e.id() );
        r.put( "source", e.source() );
        r.put( "acceptance", e.acceptance().name() );
        r.put( "type", tm.getType().name() );
        r.put( "alphabet", charsToStrings( sigma ) );
        r.put( "maxLength", maxLength );
        r.put( "structure", structure( tm ) );

        List<Integer> counts = new ArrayList<>();
        List<String> hashes = new ArrayList<>();
        List<String> all = new ArrayList<>();
        Map<String, Object> outputs = new LinkedHashMap<>();
        List<String> twoOperations = new ArrayList<>();
        List<String> stepLimit = new ArrayList<>();
        String emptyWordError = null;

        List<String> current = new ArrayList<>();
        current.add( "" );
        for ( int len = 0; len <= maxLength; len++ ) {
            if ( len > 0 ) {
                List<String> next = new ArrayList<>();
                for ( String w : current ) {
                    for ( char c : sigma ) {
                        next.add( w + c );
                    }
                }
                current = next;
            }
            List<String> accepted = new ArrayList<>();
            for ( String w : current ) {
                Run x = run( tm, w, e.acceptance() );
                if ( x.emptyWordError() != null ) {
                    emptyWordError = x.emptyWordError();
                }
                if ( x.twoOperations() ) {
                    twoOperations.add( w );
                }
                if ( !x.ableToHalt() ) {
                    stepLimit.add( w );
                }
                if ( x.accepted() ) {
                    accepted.add( w );
                    if ( e.acceptance() == HALT ) {
                        outputs.put( w, x.output() );
                    }
                }
            }
            Collections.sort( accepted );
            counts.add( accepted.size() );
            hashes.add( sha256( String.join( "\n", accepted ) ) );
            all.addAll( accepted );
        }

        Map<String, Object> lang = new LinkedHashMap<>();
        lang.put( "counts", counts );
        lang.put( "sha256", hashes );
        if ( all.size() <= MAX_EXPLICIT_WORDS ) {
            lang.put( "words", all );
        }
        r.put( "accepted", lang );
        if ( e.acceptance() == HALT ) {
            r.put( "outputs", outputs );
        }
        r.put( "yaasTwoOperations", twoOperations );
        r.put( "yaasStepLimit", stepLimit );
        if ( emptyWordError != null ) {
            r.put( "yaasEmptyWord", "TMID.derive lança " + emptyWordError
                    + " com a palavra vazia; simulada com a fita \"B\"" );
        }
        return r;

    }

    /** Casos montados para mostrar os 2 bugs da MT do YAAS. */
    static List<Object> bugs() {

        List<Object> list = new ArrayList<>();

        // bug 1: transição com duas operações (q0 → q1: 0/0 →, 1/1 →) e q1 → q2: 1/1 →
        TM tm = new TM();
        TMState q0 = new TMState( 0, null, true, false );
        TMState q1 = new TMState( 1, null, false, false );
        TMState q2 = new TMState( 2, null, false, true );
        tm.addState( q0 );
        tm.addState( q1 );
        tm.addState( q2 );
        tm.addTransition( new TMTransition( q0, q1,
                TMOperation.getMoveRightOperation( '0', '0' ),
                TMOperation.getMoveRightOperation( '1', '1' ) ) );
        tm.addTransition( new TMTransition( q1, q2,
                TMOperation.getMoveRightOperation( '1', '1' ) ) );
        list.add( bug( "duas-operacoes", "q0 → q1 com 0/0 → e 1/1 →; q1 → q2 com 1/1 →; q2 final",
                tm, "01", FS ) );

        // bug 2: limite fixo de 4000 passos (0⁴⁵1⁴⁵ precisa de 4141 passos no Exemplo 8.2)
        list.add( bug( "limite-4000-passos", "mt-0n1n (Exemplo 8.2 do Hopcroft) com 0⁴⁵1⁴⁵",
                TMExamples.createDTM0n1nFinalState(), "0".repeat( 45 ) + "1".repeat( 45 ), FS ) );

        return list;

    }

    static Map<String, Object> bug( String id, String description, TM tm, String word, TMAcceptanceType acceptance ) {
        Run x = run( tm, word, acceptance );
        Map<String, Object> m = new LinkedHashMap<>();
        m.put( "id", id );
        m.put( "description", description );
        m.put( "word", word );
        m.put( "acceptance", acceptance.name() );
        m.put( "yaasAccepted", x.accepted() );
        m.put( "yaasAbleToHalt", x.ableToHalt() );
        m.put( "yaasTwoOperations", x.twoOperations() );
        return m;
    }

    /* ------------------------------------------------------------------ */

    static int maxLength( int k ) {
        int len = 0;
        long total = 1;
        long power = 1;
        while ( len < MAX_LENGTH ) {
            power *= Math.max( k, 1 );
            if ( k == 0 || total + power > MAX_UNIVERSE ) {
                break;
            }
            total += power;
            len++;
        }
        return len;
    }

    static Map<String, Object> structure( TM tm ) throws Exception {

        List<TMState> states = tm.getStates();
        List<Object> ss = new ArrayList<>();
        for ( TMState s : states ) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put( "name", s.toString() );
            m.put( "x", s.getX1() );
            m.put( "y", s.getY1() );
            m.put( "initial", s.isInitial() );
            m.put( "final", s.isFinal() );
            ss.add( m );
        }

        Field centralField = TMTransition.class.getDeclaredField( "centralCP" );
        centralField.setAccessible( true );
        Field angleField = TMTransition.class.getDeclaredField( "targetCPAngle" );
        angleField.setAccessible( true );

        List<Object> ts = new ArrayList<>();
        for ( TMTransition t : tm.getTransitions() ) {
            Map<String, Object> m = new LinkedHashMap<>();
            TMState from = t.getOriginState();
            TMState to = t.getTargetState();
            m.put( "from", states.indexOf( from ) );
            m.put( "to", states.indexOf( to ) );
            List<Object> rules = new ArrayList<>();
            for ( TMOperation o : t.getOperations() ) {
                Map<String, Object> rm = new LinkedHashMap<>();
                rm.put( "read", String.valueOf( o.getReadSymbol() ) );
                rm.put( "write", String.valueOf( o.getWriteSymbol() ) );
                rm.put( "move", o.getType() == TMMovementType.MOVE_RIGHT ? "R" : "L" );
                rules.add( rm );
            }
            m.put( "rules", rules );
            if ( from == to ) {
                // laço: ângulo em graus (0 = em cima, positivo = sentido horário na tela)
                double angle = (double) angleField.get( t );
                m.put( "loopAngle", (int) Math.round( Math.toDegrees( angle ) ) );
            } else {
                // curva: deslocamento do ponto do meio da curva em relação ao meio
                // da reta entre os centros, dividido pelo comprimento da reta.
                // positivo = curva para a esquerda de quem anda de "from" para "to"
                Object cp = centralField.get( t );
                int cx = (int) cp.getClass().getMethod( "getX1" ).invoke( cp );
                int cy = (int) cp.getClass().getMethod( "getY1" ).invoke( cp );
                double dx = to.getX1() - from.getX1();
                double dy = to.getY1() - from.getY1();
                double len = Math.hypot( dx, dy );
                double mx = cx - ( from.getX1() + to.getX1() ) / 2.0;
                double my = cy - ( from.getY1() + to.getY1() ) / 2.0;
                double cross = ( dx * my - dy * mx ) / len;
                double curvature = len == 0 ? 0 : -cross / len;
                m.put( "curvature", Math.round( curvature * 100 ) / 100.0 );
            }
            ts.add( m );
        }

        Map<String, Object> r = new LinkedHashMap<>();
        r.put( "states", ss );
        r.put( "transitions", ts );
        return r;

    }

    static List<String> charsToStrings( Iterable<Character> cs ) {
        List<String> r = new ArrayList<>();
        for ( Character c : cs ) {
            r.add( String.valueOf( c ) );
        }
        return r;
    }

    static String sha256( String s ) throws Exception {
        MessageDigest md = MessageDigest.getInstance( "SHA-256" );
        return HexFormat.of().formatHex( md.digest( s.getBytes( StandardCharsets.UTF_8 ) ) );
    }

    /* ------------------------------------------------------------------ */
    /* JSON (sem biblioteca): listas de valores simples ficam numa linha    */
    /* ------------------------------------------------------------------ */

    static void writeJson( Object v, StringBuilder sb, int indent ) {
        if ( v == null ) {
            sb.append( "null" );
        } else if ( v instanceof Map<?, ?> map ) {
            if ( map.isEmpty() ) {
                sb.append( "{}" );
                return;
            }
            sb.append( "{\n" );
            boolean first = true;
            for ( Map.Entry<?, ?> e : map.entrySet() ) {
                if ( !first ) {
                    sb.append( ",\n" );
                }
                first = false;
                pad( sb, indent + 1 );
                writeString( String.valueOf( e.getKey() ), sb );
                sb.append( ": " );
                writeJson( e.getValue(), sb, indent + 1 );
            }
            sb.append( '\n' );
            pad( sb, indent );
            sb.append( '}' );
        } else if ( v instanceof List<?> list ) {
            boolean simple = true;
            for ( Object o : list ) {
                if ( o instanceof Map || o instanceof List ) {
                    simple = false;
                    break;
                }
            }
            if ( simple ) {
                sb.append( '[' );
                for ( int i = 0; i < list.size(); i++ ) {
                    if ( i > 0 ) {
                        sb.append( ", " );
                    }
                    writeJson( list.get( i ), sb, indent );
                }
                sb.append( ']' );
            } else {
                sb.append( "[\n" );
                for ( int i = 0; i < list.size(); i++ ) {
                    if ( i > 0 ) {
                        sb.append( ",\n" );
                    }
                    pad( sb, indent + 1 );
                    writeJson( list.get( i ), sb, indent + 1 );
                }
                sb.append( '\n' );
                pad( sb, indent );
                sb.append( ']' );
            }
        } else if ( v instanceof String s ) {
            writeString( s, sb );
        } else {
            sb.append( v );
        }
    }

    static void pad( StringBuilder sb, int indent ) {
        sb.append( "  ".repeat( indent ) );
    }

    static void writeString( String s, StringBuilder sb ) {
        sb.append( '"' );
        for ( char c : s.toCharArray() ) {
            switch ( c ) {
                case '"' -> sb.append( "\\\"" );
                case '\\' -> sb.append( "\\\\" );
                case '\n' -> sb.append( "\\n" );
                case '\t' -> sb.append( "\\t" );
                default -> {
                    if ( c < 0x20 ) {
                        sb.append( String.format( "\\u%04x", (int) c ) );
                    } else {
                        sb.append( c );
                    }
                }
            }
        }
        sb.append( '"' );
    }

}
